import {
  COMMAND_RESULT,
  CONTINUITY_COMMAND,
  INITIAL_BOUNDARY_ID,
  NAVIGATION_COMMAND,
  NAVIGATION_REASON,
  SESSION_STATUS
} from '../contracts/session.mjs';
import {
  COMMAND_SOURCE,
  EVENT_COMPONENT,
  EVENT_NAME,
  EVENT_RESULT
} from '../contracts/events.mjs';
import {
  FAULT_COMPONENT,
  FAULT_RECOVERY_CLASS
} from '../contracts/faults.mjs';
import {
  TRANSITION_PHASE,
  assertClock,
  assertRenderer,
  assertRendererRoot,
  assertScheduler,
  assertSource,
  commandOutcome,
  createOperationalState,
  detailsForCommand,
  fail,
  isPlainObject,
  readExperienceEnvelope
} from './runtime-data.mjs';
import { createRuntimeCoreSession } from './core-session.mjs';
import { createRuntimeCorrelation } from './correlation.mjs';
import { createRuntimeEventStream } from './event-stream.mjs';
import {
  beginRuntimeRender,
  closeRuntimeRender
} from './render-transition.mjs';

const RENDERER_TRANSITION_FAULT_CODE = 'CIM-RND-004';
const RENDERER_RESTORATION_FAULT_CODE = 'CIM-RND-006';

class CiMInstance {
  #controls;
  #session;
  #rendererConfig;
  #boundaryData;
  #renderer;
  #rendererRoot;
  #scheduler;
  #reducedMotion;
  #correlation;
  #eventControl;
  #operational;
  #initialized = false;
  #initializing = false;
  #activeTransition = null;
  #activeDwell = null;
  #recovering = false;

  constructor({
    instanceId,
    experience,
    clock,
    renderer = null,
    rendererRoot = null,
    reducedMotion = false
  }) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      fail('CiMInstance instanceId must be a non-empty string.');
    }
    assertClock(clock);
    if (typeof reducedMotion !== 'boolean') fail('CiMInstance reducedMotion must be boolean.');

    const envelope = readExperienceEnvelope(experience);
    const core = createRuntimeCoreSession({
      instanceId,
      experienceId: envelope.experienceId,
      experienceVersion: envelope.experienceVersion,
      stepIds: envelope.stepIds
    });
    const operational = createOperationalState();
    const correlation = createRuntimeCorrelation();
    const eventStream = createRuntimeEventStream({ instanceId, clock });

    this.#controls = core.controls;
    this.#session = core.session;
    this.#rendererConfig = envelope.rendererConfig;
    this.#boundaryData = envelope.boundaries;
    this.#renderer = renderer;
    this.#rendererRoot = rendererRoot;
    this.#scheduler = clock;
    this.#reducedMotion = reducedMotion;
    this.#correlation = correlation;
    this.#eventControl = eventStream.control;
    this.#operational = operational.state;

    this.identity = Object.freeze({
      instanceId,
      experienceId: envelope.experienceId,
      experienceVersion: envelope.experienceVersion
    });

    this.read = Object.freeze({
      snapshot: () => {
        this.#refreshDwellRemaining();
        return Object.freeze({
          canonical: this.#session.read.snapshot(),
          operational: operational.read.snapshot()
        });
      },
      boundaryIds: () => this.#session.read.boundaryIds()
    });
    this.events = eventStream.observe;
    Object.freeze(this);
  }

  async initialize() {
    if (this.#initialized) throw new Error('CiMInstance is already initialized.');
    if (this.#initializing) throw new Error('CiMInstance initialization is already in progress.');

    assertRenderer(this.#renderer);
    assertRendererRoot(this.#rendererRoot);
    assertScheduler(this.#scheduler);

    this.#initializing = true;
    try {
      await this.#renderer.mount(Object.freeze({
        root: this.#rendererRoot,
        instanceId: this.identity.instanceId
      }));
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RENDERER,
        event: EVENT_NAME.RENDERER_MOUNTED,
        result: EVENT_RESULT.SUCCESS
      });
      await this.#settleInitial();
      this.#initialized = true;
      return this.read.snapshot();
    } finally {
      this.#initializing = false;
    }
  }

  next(source = COMMAND_SOURCE.HOST) {
    return this.#submitNavigation({ command: NAVIGATION_COMMAND.NEXT }, source);
  }

  previous(source = COMMAND_SOURCE.HOST) {
    return this.#submitNavigation({ command: NAVIGATION_COMMAND.PREVIOUS }, source);
  }

  seek(stepId, source = COMMAND_SOURCE.HOST) {
    return this.#submitNavigation({ command: NAVIGATION_COMMAND.SEEK, stepId }, source);
  }

  home(source = COMMAND_SOURCE.HOST) {
    return this.#submitNavigation({ command: NAVIGATION_COMMAND.HOME }, source);
  }

  end(source = COMMAND_SOURCE.HOST) {
    return this.#submitNavigation({ command: NAVIGATION_COMMAND.END }, source);
  }

  restart(source = COMMAND_SOURCE.HOST) {
    return this.#submitNavigation({ command: NAVIGATION_COMMAND.RESTART }, source);
  }

  pause(sourceInput = COMMAND_SOURCE.HOST) {
    const source = assertSource(sourceInput);
    const commandId = this.#correlation.nextCommandId();
    const command = CONTINUITY_COMMAND.PAUSE;
    const canonical = this.#session.read.snapshot();

    if (!this.#initialized || this.#initializing) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.INVALID_STATE);
    }
    if (this.#recovering) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.INVALID_STATE);
    }
    if (canonical.status === SESSION_STATUS.FAULTED) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.FAULTED);
    }
    if (canonical.status === SESSION_STATUS.DISPOSED) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.DISPOSED);
    }
    if (canonical.status === SESSION_STATUS.PAUSED) {
      return this.#acceptNoChange(commandId, command, source, canonical.currentStepId);
    }

    if (this.#activeTransition) {
      const record = this.#activeTransition;
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.COMMAND_ACCEPTED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        from_step: canonical.currentStepId,
        to_step: record.toStepId,
        details: detailsForCommand(command, source)
      });

      const freeze = record.task.clock.controller.pause();
      if (freeze.cancelErrors.length > 0) {
        throw new AggregateError(freeze.cancelErrors, 'renderer clock pause failed to cancel scheduled work.');
      }
      record.paused = true;
      record.resumePromise = new Promise((resolve) => {
        record.resumeResolve = resolve;
      });
      this.#controls.statusControl.setStatus(SESSION_STATUS.PAUSED);
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.PLAYBACK_PAUSED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        transition_id: record.transitionId,
        from_step: canonical.currentStepId,
        to_step: record.toStepId,
        details: { source, transition_phase: TRANSITION_PHASE.IN_FLIGHT }
      });
      return commandOutcome({
        commandId,
        command,
        result: COMMAND_RESULT.SUCCESS,
        fromStepId: canonical.currentStepId,
        toStepId: record.toStepId,
        transitionId: record.transitionId
      });
    }

    if (this.#activeDwell) {
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.COMMAND_ACCEPTED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        from_step: canonical.currentStepId,
        to_step: canonical.currentStepId,
        details: detailsForCommand(command, source)
      });
      const remaining = this.#pauseActiveDwell();
      this.#controls.statusControl.setStatus(SESSION_STATUS.PAUSED);
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.PLAYBACK_PAUSED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        step_id: canonical.currentStepId,
        details: { source, dwell_remaining_ms: remaining }
      });
      return commandOutcome({
        commandId,
        command,
        result: COMMAND_RESULT.SUCCESS,
        fromStepId: canonical.currentStepId,
        toStepId: canonical.currentStepId
      });
    }

    return this.#acceptNoChange(commandId, command, source, canonical.currentStepId);
  }

  async play(sourceInput = COMMAND_SOURCE.HOST) {
    const source = assertSource(sourceInput);
    const commandId = this.#correlation.nextCommandId();
    const command = CONTINUITY_COMMAND.PLAY;
    const canonical = this.#session.read.snapshot();

    if (!this.#initialized || this.#initializing) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.INVALID_STATE);
    }
    if (this.#recovering) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.INVALID_STATE);
    }
    if (canonical.status === SESSION_STATUS.FAULTED) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.FAULTED);
    }
    if (canonical.status === SESSION_STATUS.DISPOSED) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.DISPOSED);
    }
    if (canonical.status === SESSION_STATUS.PAUSED) {
      return this.#resumePaused(commandId, source, canonical);
    }
    if (
      this.#operational.playbackIntent ||
      this.#activeTransition ||
      this.#activeDwell ||
      canonical.status !== SESSION_STATUS.IDLE
    ) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.INVALID_STATE);
    }

    const nextStepId = this.#nextBoundaryId(canonical.currentStepId);
    if (nextStepId === null) {
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.COMMAND_ACCEPTED,
        result: EVENT_RESULT.NO_CHANGE,
        command_id: commandId,
        from_step: canonical.currentStepId,
        to_step: canonical.currentStepId,
        details: detailsForCommand(command, source, NAVIGATION_REASON.AT_END)
      });
      return commandOutcome({
        commandId,
        command,
        result: COMMAND_RESULT.NO_CHANGE,
        fromStepId: canonical.currentStepId,
        toStepId: canonical.currentStepId,
        reason: NAVIGATION_REASON.AT_END
      });
    }

    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.COMMAND_ACCEPTED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      from_step: canonical.currentStepId,
      to_step: nextStepId,
      details: detailsForCommand(command, source)
    });

    this.#operational.playbackIntent = true;
    this.#controls.statusControl.setStatus(SESSION_STATUS.PLAYING);
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.PLAYBACK_STARTED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      from_step: canonical.currentStepId,
      details: { source }
    });

    let record;
    try {
      record = this.#launchPlayback(commandId, source, canonical.currentStepId, nextStepId);
    } catch (error) {
      this.#stopPlayback(commandId, 'fault', source);
      throw error;
    }

    return commandOutcome({
      commandId,
      command,
      result: COMMAND_RESULT.SUCCESS,
      fromStepId: canonical.currentStepId,
      toStepId: nextStepId,
      transitionId: record.transitionId
    });
  }

  #resumePaused(commandId, source, canonical) {
    if (this.#activeTransition) {
      const record = this.#activeTransition;
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.COMMAND_ACCEPTED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        from_step: canonical.currentStepId,
        to_step: record.toStepId,
        details: detailsForCommand(CONTINUITY_COMMAND.PLAY, source)
      });

      const resumed = record.task.clock.controller.resume();
      if (resumed.scheduleErrors.length > 0) {
        throw new AggregateError(resumed.scheduleErrors, 'renderer clock resume failed to restore scheduled work.');
      }
      record.paused = false;
      const resolve = record.resumeResolve;
      record.resumeResolve = null;
      record.resumePromise = null;
      this.#controls.statusControl.setStatus(SESSION_STATUS.TRANSITIONING);
      if (resolve) resolve();
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.PLAYBACK_RESUMED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        transition_id: record.transitionId,
        from_step: canonical.currentStepId,
        to_step: record.toStepId,
        details: { source, transition_phase: TRANSITION_PHASE.IN_FLIGHT }
      });
      return commandOutcome({
        commandId,
        command: CONTINUITY_COMMAND.PLAY,
        result: COMMAND_RESULT.SUCCESS,
        fromStepId: canonical.currentStepId,
        toStepId: record.toStepId,
        transitionId: record.transitionId
      });
    }

    if (this.#activeDwell?.paused) {
      const remaining = this.#activeDwell.remainingMs;
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.COMMAND_ACCEPTED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        from_step: canonical.currentStepId,
        to_step: canonical.currentStepId,
        details: detailsForCommand(CONTINUITY_COMMAND.PLAY, source)
      });
      this.#resumeActiveDwell();
      this.#controls.statusControl.setStatus(SESSION_STATUS.PLAYING);
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.PLAYBACK_RESUMED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        step_id: canonical.currentStepId,
        details: { source, dwell_remaining_ms: remaining }
      });
      return commandOutcome({
        commandId,
        command: CONTINUITY_COMMAND.PLAY,
        result: COMMAND_RESULT.SUCCESS,
        fromStepId: canonical.currentStepId,
        toStepId: canonical.currentStepId
      });
    }

    return this.#rejectCommand(
      commandId,
      CONTINUITY_COMMAND.PLAY,
      source,
      canonical.currentStepId,
      NAVIGATION_REASON.INVALID_STATE
    );
  }

  async #settleInitial() {
    const transitionId = this.#correlation.nextTransitionId();
    const boundary = this.#boundaryData.get(INITIAL_BOUNDARY_ID);
    const task = beginRuntimeRender({
      renderer: this.#renderer,
      scheduler: this.#scheduler,
      rendererConfig: this.#rendererConfig,
      reducedMotion: this.#reducedMotion,
      transitionId,
      stepId: INITIAL_BOUNDARY_ID,
      state: boundary.state,
      stepRendererConfig: null,
      animate: false
    });

    this.#setOperationalTransition(transitionId);
    this.#controls.statusControl.setStatus(SESSION_STATUS.TRANSITIONING);
    const outcome = await task.renderDone;
    closeRuntimeRender(task);

    if (outcome.kind === 'settled') {
      this.#operational.transitionPhase = TRANSITION_PHASE.SETTLED;
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RENDERER,
        event: EVENT_NAME.RENDERER_SETTLED,
        result: EVENT_RESULT.SUCCESS,
        transition_id: transitionId,
        step_id: INITIAL_BOUNDARY_ID
      });
      this.#clearOperationalTransition(transitionId);
      this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);
      this.#eventControl.emit({
        component: EVENT_COMPONENT.CORE,
        event: EVENT_NAME.STEP_INITIAL,
        result: EVENT_RESULT.SUCCESS,
        transition_id: transitionId,
        step_id: INITIAL_BOUNDARY_ID
      });
      return;
    }

    this.#clearOperationalTransition(transitionId);
    this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);
    this.#emitRendererOutcome({
      transitionId,
      commandId: null,
      fromStepId: INITIAL_BOUNDARY_ID,
      toStepId: INITIAL_BOUNDARY_ID
    }, outcome);
    throw outcome.error ?? new Error('initial renderer settlement failed.');
  }

  async #submitNavigation(request, sourceInput) {
    const source = assertSource(sourceInput);
    const commandId = this.#correlation.nextCommandId();
    const command = request.command;
    const canonical = this.#session.read.snapshot();

    if (!this.#initialized || this.#initializing) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.INVALID_STATE);
    }
    if (this.#recovering) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.INVALID_STATE);
    }

    const resolution = this.#session.navigation.resolve(request);
    if (resolution.result === COMMAND_RESULT.REJECTED) {
      return this.#rejectCommand(commandId, command, source, resolution.fromStepId, resolution.reason);
    }

    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.COMMAND_ACCEPTED,
      result: resolution.result,
      command_id: commandId,
      from_step: resolution.fromStepId,
      ...(resolution.toStepId === null ? {} : { to_step: resolution.toStepId }),
      details: detailsForCommand(command, source, resolution.reason)
    });

    this.#stopPlaybackForNavigation(commandId, command, source);
    const hadActiveTransition = this.#activeTransition !== null;
    if (hadActiveTransition) {
      await this.#cancelActiveTransition(command === NAVIGATION_COMMAND.RESTART ? 'restart' : 'navigation');
    }

    if (resolution.result !== COMMAND_RESULT.SUCCESS && !hadActiveTransition) {
      return commandOutcome({
        commandId,
        command,
        result: resolution.result,
        fromStepId: resolution.fromStepId,
        toStepId: resolution.toStepId,
        reason: resolution.reason
      });
    }

    return this.#settleDiscrete(commandId, source, resolution, resolution.toStepId ?? resolution.fromStepId);
  }

  async #settleDiscrete(commandId, source, resolution, targetStepId) {
    this.#controls.semanticControl.beginTarget(targetStepId);
    const record = this.#beginTransition({
      mode: 'navigation',
      commandId,
      command: resolution.command,
      source,
      fromStepId: resolution.fromStepId,
      toStepId: targetStepId,
      animate: false
    });

    const outcome = await record.task.renderDone;
    await this.#waitForTransitionResume(record);
    closeRuntimeRender(record.task);

    if (record.cancelled || this.#activeTransition !== record || outcome.kind === 'cancelled') {
      this.#reportTransitionRendererOutcome(record, outcome);
      this.#clearActiveTransition(record);
      return commandOutcome({
        commandId,
        command: resolution.command,
        result: EVENT_RESULT.CANCELLED,
        fromStepId: resolution.fromStepId,
        toStepId: targetStepId,
        reason: record.cancelReason ?? 'navigation',
        transitionId: record.transitionId
      });
    }

    if (outcome.kind === 'error') {
      this.#reportTransitionRendererOutcome(record, outcome, RENDERER_TRANSITION_FAULT_CODE);
      this.#emitTransitionFailed(record, RENDERER_TRANSITION_FAULT_CODE);
      this.#controls.semanticControl.abandonTarget(targetStepId);
      this.#clearActiveTransition(record);
      await this.#recoverRendererFailure(record);
      throw outcome.error;
    }

    this.#emitSettled(record);
    const before = this.#session.read.snapshot();
    const after = resolution.command === NAVIGATION_COMMAND.RESTART
      ? this.#controls.semanticControl.commitRestart()
      : this.#controls.semanticControl.commitTarget(targetStepId);

    this.#clearActiveTransition(record);
    this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);
    this.#emitStepChanged(record, before, after);

    return commandOutcome({
      commandId,
      command: resolution.command,
      result: resolution.result,
      fromStepId: resolution.fromStepId,
      toStepId: targetStepId,
      reason: resolution.reason,
      transitionId: record.transitionId
    });
  }

  #launchPlayback(commandId, source, fromStepId, toStepId) {
    this.#controls.semanticControl.beginTarget(toStepId);
    let record;
    try {
      record = this.#beginTransition({
        mode: 'playback',
        commandId,
        command: CONTINUITY_COMMAND.PLAY,
        source,
        fromStepId,
        toStepId,
        animate: true
      });
    } catch (error) {
      this.#controls.semanticControl.abandonTarget(toStepId);
      throw error;
    }

    void this.#finishPlayback(record).catch(() => {
      const canonical = this.#session.read.snapshot();
      if (canonical.targetStepId === record.toStepId) {
        try {
          this.#controls.semanticControl.abandonTarget(record.toStepId);
        } catch {}
      }
      this.#releaseTransitionPause(record);
      this.#clearActiveTransition(record);
      this.#stopPlayback(record.commandId, 'fault', record.source);
    });
    return record;
  }

  async #finishPlayback(record) {
    const outcome = await record.task.renderDone;
    await this.#waitForTransitionResume(record);
    closeRuntimeRender(record.task);

    if (record.cancelled || this.#activeTransition !== record || outcome.kind === 'cancelled') {
      this.#reportTransitionRendererOutcome(record, outcome);
      this.#clearActiveTransition(record);
      return;
    }

    if (outcome.kind === 'error') {
      this.#reportTransitionRendererOutcome(record, outcome, RENDERER_TRANSITION_FAULT_CODE);
      this.#emitTransitionFailed(record, RENDERER_TRANSITION_FAULT_CODE);
      this.#controls.semanticControl.abandonTarget(record.toStepId);
      this.#clearActiveTransition(record);
      await this.#recoverRendererFailure(record);
      return;
    }

    this.#emitSettled(record);
    const before = this.#session.read.snapshot();
    const after = this.#controls.semanticControl.commitTarget(record.toStepId);
    this.#clearActiveTransition(record);
    this.#controls.statusControl.setStatus(SESSION_STATUS.PLAYING);
    this.#emitStepChanged(record, before, after);

    if (!this.#operational.playbackIntent) return;
    const boundary = this.#boundaryData.get(after.currentStepId);
    if (boundary.dwellMs > 0) {
      this.#startDwell(record.commandId, record.source, after.currentStepId, boundary.dwellMs);
    } else {
      this.#continuePlayback(record.commandId, record.source, after.currentStepId);
    }
  }

  #beginTransition({ mode, commandId, command, source, fromStepId, toStepId, animate }) {
    const transitionId = this.#correlation.nextTransitionId();
    const fromBoundary = this.#boundaryData.get(fromStepId);
    const toBoundary = this.#boundaryData.get(toStepId);
    const task = beginRuntimeRender({
      renderer: this.#renderer,
      scheduler: this.#scheduler,
      rendererConfig: this.#rendererConfig,
      reducedMotion: this.#reducedMotion,
      transitionId,
      stepId: toStepId,
      state: toBoundary.state,
      stepRendererConfig: toBoundary.stepRendererConfig,
      animate,
      fromStepId,
      fromState: fromBoundary.state
    });

    const record = {
      mode,
      commandId,
      command,
      source,
      transitionId,
      fromStepId,
      toStepId,
      task,
      cancelled: false,
      cancelReason: null,
      transitionCancelledReported: false,
      rendererOutcomeReported: false,
      paused: false,
      resumePromise: null,
      resumeResolve: null
    };
    this.#activeTransition = record;
    this.#setOperationalTransition(transitionId);
    this.#controls.statusControl.setStatus(SESSION_STATUS.TRANSITIONING);
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.TRANSITION_STARTED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      transition_id: transitionId,
      from_step: fromStepId,
      to_step: toStepId
    });
    return record;
  }

  async #waitForTransitionResume(record) {
    if (!record.paused || !record.resumePromise) return;
    await record.resumePromise;
  }

  #releaseTransitionPause(record) {
    if (!record.resumeResolve) return;
    const resolve = record.resumeResolve;
    record.paused = false;
    record.resumeResolve = null;
    record.resumePromise = null;
    resolve();
  }

  async #cancelActiveTransition(reason) {
    const record = this.#activeTransition;
    if (!record) return false;

    record.cancelled = true;
    record.cancelReason = reason;
    if (
      this.#operational.activeAbortState &&
      this.#operational.activeAbortState.transitionId === record.transitionId
    ) {
      this.#operational.activeAbortState = Object.freeze({
        transitionId: record.transitionId,
        aborted: true,
        reason
      });
    }

    record.task.abort.controller.abort(reason);
    record.task.clock.controller.revoke();
    this.#releaseTransitionPause(record);
    const canonical = this.#session.read.snapshot();
    if (canonical.targetStepId === record.toStepId) {
      this.#controls.semanticControl.abandonTarget(record.toStepId);
    }

    if (!record.transitionCancelledReported) {
      record.transitionCancelledReported = true;
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.TRANSITION_CANCELLED,
        result: EVENT_RESULT.CANCELLED,
        command_id: record.commandId,
        transition_id: record.transitionId,
        from_step: record.fromStepId,
        to_step: record.toStepId,
        details: { reason }
      });
    }

    const outcome = await record.task.renderDone;
    closeRuntimeRender(record.task);
    this.#reportTransitionRendererOutcome(record, outcome);
    this.#clearActiveTransition(record);
    return true;
  }

  #emitSettled(record) {
    this.#operational.transitionPhase = TRANSITION_PHASE.SETTLED;
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RENDERER,
      event: EVENT_NAME.RENDERER_SETTLED,
      result: EVENT_RESULT.SUCCESS,
      command_id: record.commandId,
      transition_id: record.transitionId,
      step_id: record.toStepId
    });
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.TRANSITION_SETTLED,
      result: EVENT_RESULT.SUCCESS,
      command_id: record.commandId,
      transition_id: record.transitionId,
      from_step: record.fromStepId,
      to_step: record.toStepId
    });
  }

  #emitTransitionFailed(record, errorCode = null) {
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.TRANSITION_FAILED,
      result: EVENT_RESULT.FAILED,
      command_id: record.commandId,
      transition_id: record.transitionId,
      from_step: record.fromStepId,
      to_step: record.toStepId,
      ...(errorCode === null ? {} : { error_code: errorCode })
    });
  }

  #emitStepChanged(record, before, after) {
    if (before.currentStepId === after.currentStepId) return;
    this.#eventControl.emit({
      component: EVENT_COMPONENT.CORE,
      event: EVENT_NAME.STEP_CHANGED,
      result: EVENT_RESULT.SUCCESS,
      command_id: record.commandId,
      transition_id: record.transitionId,
      from_step: before.currentStepId,
      to_step: after.currentStepId,
      step_id: after.currentStepId
    });
  }

  #reportTransitionRendererOutcome(record, outcome, errorCode = null) {
    if (record.rendererOutcomeReported) return;
    record.rendererOutcomeReported = true;
    this.#emitRendererOutcome({
      transitionId: record.transitionId,
      commandId: record.commandId,
      fromStepId: record.fromStepId,
      toStepId: record.toStepId
    }, outcome, errorCode);
  }

  #emitRendererOutcome({ transitionId, commandId, fromStepId, toStepId }, outcome, errorCode = null) {
    if (outcome.kind === 'cancelled') {
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RENDERER,
        event: EVENT_NAME.RENDERER_CANCELLED,
        result: EVENT_RESULT.CANCELLED,
        ...(commandId === null ? {} : { command_id: commandId }),
        transition_id: transitionId,
        from_step: fromStepId,
        to_step: toStepId,
        details: { reason: outcome.reason ?? null }
      });
    } else if (outcome.kind === 'error') {
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RENDERER,
        event: EVENT_NAME.RENDERER_ERROR,
        result: EVENT_RESULT.FAILED,
        ...(commandId === null ? {} : { command_id: commandId }),
        transition_id: transitionId,
        from_step: fromStepId,
        to_step: toStepId,
        ...(errorCode === null ? {} : { error_code: errorCode }),
        details: { message: outcome.error?.message ?? String(outcome.error) }
      });
    }
  }

  async #recoverRendererFailure(record) {
    if (this.#recovering) {
      throw new Error('Runtime renderer recovery is already active.');
    }

    this.#recovering = true;
    try {
      this.#stopPlaybackForFault(record.commandId, record.source);
      const anchor = this.#session.read.snapshot().currentStepId;
      const recoverFault = Object.freeze({
        code: RENDERER_TRANSITION_FAULT_CODE,
        component: FAULT_COMPONENT.RENDERER,
        recoveryClass: FAULT_RECOVERY_CLASS.RECOVER
      });
      this.#controls.faultControl.recordFault(recoverFault);

      const recoveryTransitionId = this.#correlation.nextTransitionId();
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.RECOVERY_STARTED,
        result: EVENT_RESULT.SUCCESS,
        command_id: record.commandId,
        transition_id: recoveryTransitionId,
        step_id: anchor,
        error_code: RENDERER_TRANSITION_FAULT_CODE,
        details: {
          failed_transition_id: record.transitionId,
          failed_step: record.toStepId
        }
      });

      const boundary = this.#boundaryData.get(anchor);
      const task = beginRuntimeRender({
        renderer: this.#renderer,
        scheduler: this.#scheduler,
        rendererConfig: this.#rendererConfig,
        reducedMotion: this.#reducedMotion,
        transitionId: recoveryTransitionId,
        stepId: anchor,
        state: boundary.state,
        stepRendererConfig: boundary.stepRendererConfig,
        animate: false
      });

      this.#setOperationalTransition(recoveryTransitionId);
      this.#controls.statusControl.setStatus(SESSION_STATUS.TRANSITIONING);
      const outcome = await task.renderDone;
      closeRuntimeRender(task);

      if (outcome.kind === 'settled') {
        this.#operational.transitionPhase = TRANSITION_PHASE.SETTLED;
        this.#eventControl.emit({
          component: EVENT_COMPONENT.RENDERER,
          event: EVENT_NAME.RENDERER_SETTLED,
          result: EVENT_RESULT.SUCCESS,
          command_id: record.commandId,
          transition_id: recoveryTransitionId,
          step_id: anchor
        });
        this.#clearOperationalTransition(recoveryTransitionId);
        this.#controls.faultControl.clearRecoverableFault(RENDERER_TRANSITION_FAULT_CODE);
        this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);
        this.#eventControl.emit({
          component: EVENT_COMPONENT.RUNTIME,
          event: EVENT_NAME.RECOVERY_SUCCEEDED,
          result: EVENT_RESULT.RECOVERED,
          command_id: record.commandId,
          transition_id: recoveryTransitionId,
          step_id: anchor,
          error_code: RENDERER_TRANSITION_FAULT_CODE,
          recovered: true,
          details: { failed_transition_id: record.transitionId }
        });
        return true;
      }

      this.#emitRendererOutcome({
        transitionId: recoveryTransitionId,
        commandId: record.commandId,
        fromStepId: anchor,
        toStepId: anchor
      }, outcome, RENDERER_RESTORATION_FAULT_CODE);
      this.#clearOperationalTransition(recoveryTransitionId);
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.RECOVERY_FAILED,
        result: EVENT_RESULT.FAILED,
        command_id: record.commandId,
        transition_id: recoveryTransitionId,
        step_id: anchor,
        error_code: RENDERER_RESTORATION_FAULT_CODE,
        recovered: false,
        details: {
          failed_transition_id: record.transitionId,
          message: outcome.error?.message ?? String(outcome.error)
        }
      });

      this.#controls.faultControl.recordFault(Object.freeze({
        code: RENDERER_RESTORATION_FAULT_CODE,
        component: FAULT_COMPONENT.RENDERER,
        recoveryClass: FAULT_RECOVERY_CLASS.FALLBACK
      }));
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.INSTANCE_FAULTED,
        result: EVENT_RESULT.FAILED,
        command_id: record.commandId,
        transition_id: recoveryTransitionId,
        step_id: anchor,
        error_code: RENDERER_RESTORATION_FAULT_CODE,
        recovered: false,
        details: { failed_transition_id: record.transitionId }
      });
      return false;
    } finally {
      this.#recovering = false;
    }
  }

  #stopPlaybackForFault(commandId, source) {
    this.#cancelActiveDwell('fault', commandId);
    this.#operational.dwellRemainingMs = 0;
    if (!this.#operational.playbackIntent) return false;

    this.#operational.playbackIntent = false;
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.PLAYBACK_STOPPED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      details: { reason: 'fault', source }
    });
    return true;
  }

  #continuePlayback(commandId, source, fromStepId) {
    if (!this.#operational.playbackIntent) return;
    const nextStepId = this.#nextBoundaryId(fromStepId);
    if (nextStepId === null) {
      this.#stopPlayback(commandId, 'at_end', source);
      return;
    }
    this.#launchPlayback(commandId, source, fromStepId, nextStepId);
  }

  #startDwell(commandId, source, stepId, dwellMs) {
    if (!this.#operational.playbackIntent) return;
    if (this.#activeDwell) throw new Error('Runtime cannot begin dwell while another dwell is active.');

    const startedAt = this.#readSchedulerNow();
    const record = {
      commandId,
      source,
      stepId,
      dwellMs,
      remainingMs: dwellMs,
      startedAt,
      handle: null,
      paused: false
    };
    this.#activeDwell = record;
    this.#operational.dwellRemainingMs = dwellMs;
    this.#controls.statusControl.setStatus(SESSION_STATUS.PLAYING);
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.DWELL_STARTED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      step_id: stepId,
      details: { dwell_ms: dwellMs }
    });
    this.#armDwell(record, dwellMs);
  }

  #armDwell(record, delayMs) {
    record.handle = this.#scheduler.schedule.call(this.#scheduler, () => {
      if (this.#activeDwell !== record || record.paused) return;
      this.#activeDwell = null;
      this.#operational.dwellRemainingMs = 0;
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.DWELL_COMPLETED,
        result: EVENT_RESULT.SUCCESS,
        command_id: record.commandId,
        step_id: record.stepId,
        details: { dwell_ms: record.dwellMs }
      });
      this.#continuePlayback(record.commandId, record.source, record.stepId);
    }, delayMs);
  }

  #pauseActiveDwell() {
    const record = this.#activeDwell;
    if (!record || record.paused) return this.#operational.dwellRemainingMs;

    const remaining = this.#dwellRemaining(record);
    if (record.handle !== null) this.#scheduler.cancel.call(this.#scheduler, record.handle);
    record.handle = null;
    record.remainingMs = remaining;
    record.startedAt = null;
    record.paused = true;
    this.#operational.dwellRemainingMs = remaining;
    return remaining;
  }

  #resumeActiveDwell() {
    const record = this.#activeDwell;
    if (!record?.paused) throw new Error('Runtime has no paused dwell to resume.');

    record.startedAt = this.#readSchedulerNow();
    record.paused = false;
    this.#operational.dwellRemainingMs = record.remainingMs;
    this.#armDwell(record, record.remainingMs);
  }

  #cancelActiveDwell(reason, commandId) {
    const record = this.#activeDwell;
    if (!record) {
      this.#operational.dwellRemainingMs = 0;
      return false;
    }

    const remaining = this.#dwellRemaining(record);
    if (record.handle !== null) this.#scheduler.cancel.call(this.#scheduler, record.handle);
    this.#activeDwell = null;
    this.#operational.dwellRemainingMs = 0;
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.DWELL_CANCELLED,
      result: EVENT_RESULT.CANCELLED,
      command_id: commandId,
      step_id: record.stepId,
      details: { reason, dwell_remaining_ms: remaining }
    });
    return true;
  }

  #dwellRemaining(record) {
    if (record.paused) return record.remainingMs;
    const now = this.#readSchedulerNow();
    return Math.max(0, record.remainingMs - Math.max(0, now - record.startedAt));
  }

  #readSchedulerNow() {
    const now = this.#scheduler.now.call(this.#scheduler);
    if (!Number.isFinite(now) || now < 0) {
      throw new RangeError('CiMInstance scheduler.now() must return a finite non-negative number.');
    }
    return now;
  }

  #stopPlaybackForNavigation(commandId, command, source) {
    const reason = command === NAVIGATION_COMMAND.RESTART ? 'restart' : 'navigation';
    this.#cancelActiveDwell(reason, commandId);
    if (!this.#operational.playbackIntent) return;

    this.#operational.playbackIntent = false;
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.PLAYBACK_STOPPED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      details: { reason, source }
    });
  }

  #stopPlayback(commandId, reason, source) {
    this.#cancelActiveDwell(reason, commandId);
    if (!this.#operational.playbackIntent) {
      if (this.#session.read.snapshot().status === SESSION_STATUS.PLAYING) {
        this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);
      }
      return false;
    }

    this.#operational.playbackIntent = false;
    this.#operational.dwellRemainingMs = 0;
    const canonical = this.#session.read.snapshot();
    if (canonical.status !== SESSION_STATUS.FAULTED && canonical.status !== SESSION_STATUS.DISPOSED) {
      this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);
    }
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.PLAYBACK_STOPPED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      details: { reason, source }
    });
    return true;
  }

  #setOperationalTransition(transitionId) {
    this.#operational.transitionId = transitionId;
    this.#operational.transitionPhase = TRANSITION_PHASE.IN_FLIGHT;
    this.#operational.activeAbortState = Object.freeze({
      transitionId,
      aborted: false,
      reason: null
    });
  }

  #clearOperationalTransition(transitionId) {
    if (this.#operational.transitionId !== transitionId) return;
    this.#operational.transitionId = null;
    this.#operational.transitionPhase = TRANSITION_PHASE.IDLE;
    this.#operational.activeAbortState = null;
  }

  #clearActiveTransition(record) {
    if (this.#activeTransition === record) this.#activeTransition = null;
    this.#releaseTransitionPause(record);
    this.#clearOperationalTransition(record.transitionId);
  }

  #refreshDwellRemaining() {
    const record = this.#activeDwell;
    if (!record) {
      this.#operational.dwellRemainingMs = 0;
      return;
    }
    this.#operational.dwellRemainingMs = this.#dwellRemaining(record);
  }

  #nextBoundaryId(stepId) {
    const ids = this.#session.read.boundaryIds();
    const index = ids.indexOf(stepId);
    return index < 0 || index === ids.length - 1 ? null : ids[index + 1];
  }

  #acceptNoChange(commandId, command, source, stepId) {
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.COMMAND_ACCEPTED,
      result: EVENT_RESULT.NO_CHANGE,
      command_id: commandId,
      from_step: stepId,
      to_step: stepId,
      details: detailsForCommand(command, source)
    });
    return commandOutcome({
      commandId,
      command,
      result: COMMAND_RESULT.NO_CHANGE,
      fromStepId: stepId,
      toStepId: stepId
    });
  }

  #rejectCommand(commandId, command, source, fromStepId, reason) {
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.COMMAND_REJECTED,
      result: EVENT_RESULT.REJECTED,
      command_id: commandId,
      from_step: fromStepId,
      details: detailsForCommand(command, source, reason)
    });
    return commandOutcome({
      commandId,
      command,
      result: COMMAND_RESULT.REJECTED,
      fromStepId,
      toStepId: null,
      reason
    });
  }
}

export function createCiMInstance(options) {
  if (!isPlainObject(options)) fail('createCiMInstance options must be a plain object.');

  const descriptors = Object.getOwnPropertyDescriptors(options);
  const required = (key) => {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(`createCiMInstance options.${key} must be an enumerable data property.`);
    }
    return descriptor.value;
  };
  const optional = (key, fallback) => {
    const descriptor = descriptors[key];
    if (!descriptor) return fallback;
    if (!descriptor.enumerable || !('value' in descriptor)) {
      fail(`createCiMInstance options.${key} must be an enumerable data property when present.`);
    }
    return descriptor.value;
  };

  return new CiMInstance({
    instanceId: required('instanceId'),
    experience: required('experience'),
    clock: required('clock'),
    renderer: optional('renderer', null),
    rendererRoot: optional('rendererRoot', null),
    reducedMotion: optional('reducedMotion', false)
  });
}
