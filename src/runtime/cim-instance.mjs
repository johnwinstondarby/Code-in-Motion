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

  async play(sourceInput = COMMAND_SOURCE.HOST) {
    const source = assertSource(sourceInput);
    const commandId = this.#correlation.nextCommandId();
    const command = CONTINUITY_COMMAND.PLAY;
    const canonical = this.#session.read.snapshot();

    if (!this.#initialized || this.#initializing) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.INVALID_STATE);
    }
    if (canonical.status === SESSION_STATUS.FAULTED) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.FAULTED);
    }
    if (canonical.status === SESSION_STATUS.DISPOSED) {
      return this.#rejectCommand(commandId, command, source, canonical.currentStepId, NAVIGATION_REASON.DISPOSED);
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
      this.#operational.transitionProgress = 1;
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
      this.#reportTransitionRendererOutcome(record, outcome);
      this.#emitTransitionFailed(record);
      this.#controls.semanticControl.abandonTarget(targetStepId);
      this.#clearActiveTransition(record);
      this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);
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
      this.#clearActiveTransition(record);
      this.#stopPlayback(record.commandId, 'fault', record.source);
    });
    return record;
  }

  async #finishPlayback(record) {
    const outcome = await record.task.renderDone;
    closeRuntimeRender(record.task);

    if (record.cancelled || this.#activeTransition !== record || outcome.kind === 'cancelled') {
      this.#reportTransitionRendererOutcome(record, outcome);
      this.#clearActiveTransition(record);
      return;
    }

    if (outcome.kind === 'error') {
      this.#reportTransitionRendererOutcome(record, outcome);
      this.#emitTransitionFailed(record);
      this.#controls.semanticControl.abandonTarget(record.toStepId);
      this.#clearActiveTransition(record);
      this.#stopPlayback(record.commandId, 'fault', record.source);
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
      rendererOutcomeReported: false
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
    this.#operational.transitionProgress = 1;
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

  #emitTransitionFailed(record) {
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.TRANSITION_FAILED,
      result: EVENT_RESULT.FAILED,
      command_id: record.commandId,
      transition_id: record.transitionId,
      from_step: record.fromStepId,
      to_step: record.toStepId
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

  #reportTransitionRendererOutcome(record, outcome) {
    if (record.rendererOutcomeReported) return;
    record.rendererOutcomeReported = true;
    this.#emitRendererOutcome({
      transitionId: record.transitionId,
      commandId: record.commandId,
      fromStepId: record.fromStepId,
      toStepId: record.toStepId
    }, outcome);
  }

  #emitRendererOutcome({ transitionId, commandId, fromStepId, toStepId }, outcome) {
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
        details: { message: outcome.error?.message ?? String(outcome.error) }
      });
    }
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

    const startedAt = this.#scheduler.now.call(this.#scheduler);
    if (!Number.isFinite(startedAt) || startedAt < 0) {
      throw new RangeError('CiMInstance scheduler.now() must return a finite non-negative number.');
    }

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

    const record = { commandId, source, stepId, dwellMs, startedAt, handle: null };
    this.#activeDwell = record;
    record.handle = this.#scheduler.schedule.call(this.#scheduler, () => {
      if (this.#activeDwell !== record) return;
      this.#activeDwell = null;
      this.#operational.dwellRemainingMs = 0;
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.DWELL_COMPLETED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        step_id: stepId,
        details: { dwell_ms: dwellMs }
      });
      this.#continuePlayback(commandId, source, stepId);
    }, dwellMs);
  }

  #cancelActiveDwell(reason, commandId) {
    const record = this.#activeDwell;
    if (!record) {
      this.#operational.dwellRemainingMs = 0;
      return false;
    }

    const now = this.#scheduler.now.call(this.#scheduler);
    const elapsed = Number.isFinite(now) ? Math.max(0, now - record.startedAt) : 0;
    const remaining = Math.max(0, record.dwellMs - elapsed);
    this.#scheduler.cancel.call(this.#scheduler, record.handle);
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
    this.#operational.transitionProgress = 0;
    this.#operational.activeAbortState = Object.freeze({
      transitionId,
      aborted: false,
      reason: null
    });
  }

  #clearOperationalTransition(transitionId) {
    if (this.#operational.transitionId !== transitionId) return;
    this.#operational.transitionId = null;
    this.#operational.transitionProgress = 0;
    this.#operational.activeAbortState = null;
  }

  #clearActiveTransition(record) {
    if (this.#activeTransition === record) this.#activeTransition = null;
    this.#clearOperationalTransition(record.transitionId);
  }

  #refreshDwellRemaining() {
    const record = this.#activeDwell;
    if (!record) {
      this.#operational.dwellRemainingMs = 0;
      return;
    }
    const now = this.#scheduler.now.call(this.#scheduler);
    if (!Number.isFinite(now) || now < 0) return;
    this.#operational.dwellRemainingMs = Math.max(0, record.dwellMs - Math.max(0, now - record.startedAt));
  }

  #nextBoundaryId(stepId) {
    const ids = this.#session.read.boundaryIds();
    const index = ids.indexOf(stepId);
    return index < 0 || index === ids.length - 1 ? null : ids[index + 1];
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
