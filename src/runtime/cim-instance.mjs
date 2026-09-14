import {
  COMMAND_RESULT,
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
import { createRendererContext } from './renderer-context.mjs';
import {
  createRendererAbortCapability,
  createRendererClockCapability
} from './renderer-capabilities.mjs';
import { classifyRendererRejection } from './renderer-outcome.mjs';
import { createRuntimeCoreSession } from './core-session.mjs';
import { createRuntimeCorrelation } from './correlation.mjs';
import { createRuntimeEventStream } from './event-stream.mjs';

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
      snapshot: () => Object.freeze({
        canonical: this.#session.read.snapshot(),
        operational: operational.read.snapshot()
      }),
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

      const transitionId = this.#correlation.nextTransitionId();
      const outcome = await this.#renderInitial(transitionId);
      if (outcome.kind !== 'settled') {
        throw outcome.error ?? new Error('initial renderer settlement failed.');
      }

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

  async #renderInitial(transitionId) {
    const boundary = this.#boundaryData.get(INITIAL_BOUNDARY_ID);
    const capabilities = this.#createRenderCapabilities(transitionId);
    const context = createRendererContext({
      animate: false,
      fromState: null,
      fromStepId: null,
      stepId: INITIAL_BOUNDARY_ID,
      rendererConfig: this.#rendererConfig,
      stepRendererConfig: null,
      transitionId,
      abortSignal: capabilities.abort.facade,
      clock: capabilities.clock.facade,
      reducedMotion: this.#reducedMotion
    });

    this.#controls.statusControl.setStatus(SESSION_STATUS.TRANSITIONING);
    this.#setOperationalTransition(transitionId);

    const renderDone = Promise.resolve()
      .then(() => this.#renderer.render(boundary.state, context))
      .then(
        () => Object.freeze({ kind: 'settled' }),
        (error) => classifyRendererRejection(error, {
          abortSignal: capabilities.abort.facade,
          transitionId
        })
      );

    const outcome = await renderDone;
    capabilities.clock.controller.revoke();
    capabilities.abort.controller.close();

    if (outcome.kind === 'settled') {
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
      return outcome;
    }

    this.#clearOperationalTransition(transitionId);
    this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);
    this.#emitRendererOutcome({
      transitionId,
      commandId: null,
      fromStepId: INITIAL_BOUNDARY_ID,
      toStepId: INITIAL_BOUNDARY_ID
    }, outcome);
    return outcome;
  }

  async #submitNavigation(request, sourceInput) {
    const source = assertSource(sourceInput);
    const commandId = this.#correlation.nextCommandId();
    const command = request.command;

    if (!this.#initialized || this.#initializing) {
      const fromStepId = this.#session.read.snapshot().currentStepId;
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.COMMAND_REJECTED,
        result: EVENT_RESULT.REJECTED,
        command_id: commandId,
        from_step: fromStepId,
        details: detailsForCommand(command, source, NAVIGATION_REASON.INVALID_STATE)
      });
      return commandOutcome({
        commandId,
        command,
        result: COMMAND_RESULT.REJECTED,
        fromStepId,
        toStepId: null,
        reason: NAVIGATION_REASON.INVALID_STATE
      });
    }

    const resolution = this.#session.navigation.resolve(request);

    if (resolution.result === COMMAND_RESULT.REJECTED) {
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.COMMAND_REJECTED,
        result: EVENT_RESULT.REJECTED,
        command_id: commandId,
        from_step: resolution.fromStepId,
        details: detailsForCommand(command, source, resolution.reason)
      });
      return commandOutcome({
        commandId,
        command,
        result: resolution.result,
        fromStepId: resolution.fromStepId,
        toStepId: resolution.toStepId,
        reason: resolution.reason
      });
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
      await this.#cancelActiveTransition(
        command === NAVIGATION_COMMAND.RESTART ? 'restart' : 'navigation'
      );
    }

    const requiresSettlement =
      resolution.result === COMMAND_RESULT.SUCCESS || hadActiveTransition;

    if (!requiresSettlement) {
      return commandOutcome({
        commandId,
        command,
        result: resolution.result,
        fromStepId: resolution.fromStepId,
        toStepId: resolution.toStepId,
        reason: resolution.reason
      });
    }

    const targetStepId = resolution.toStepId ?? resolution.fromStepId;
    return this.#settleNavigation({
      commandId,
      source,
      resolution,
      targetStepId
    });
  }

  async #settleNavigation({ commandId, source, resolution, targetStepId }) {
    this.#controls.semanticControl.beginTarget(targetStepId);

    const transitionId = this.#correlation.nextTransitionId();
    const capabilities = this.#createRenderCapabilities(transitionId);
    const record = {
      commandId,
      command: resolution.command,
      source,
      transitionId,
      fromStepId: resolution.fromStepId,
      toStepId: targetStepId,
      resolution,
      capabilities,
      cancelled: false,
      cancelReason: null,
      transitionCancelledReported: false,
      rendererOutcomeReported: false,
      renderDone: null
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
      from_step: resolution.fromStepId,
      to_step: targetStepId
    });

    const boundary = this.#boundaryData.get(targetStepId);
    const context = createRendererContext({
      animate: false,
      fromState: null,
      fromStepId: null,
      stepId: targetStepId,
      rendererConfig: this.#rendererConfig,
      stepRendererConfig: boundary.stepRendererConfig,
      transitionId,
      abortSignal: capabilities.abort.facade,
      clock: capabilities.clock.facade,
      reducedMotion: this.#reducedMotion
    });

    record.renderDone = Promise.resolve()
      .then(() => this.#renderer.render(boundary.state, context))
      .then(
        () => Object.freeze({ kind: 'settled' }),
        (error) => classifyRendererRejection(error, {
          abortSignal: capabilities.abort.facade,
          transitionId
        })
      );

    const outcome = await record.renderDone;
    capabilities.clock.controller.revoke();
    capabilities.abort.controller.close();

    if (record.cancelled || this.#activeTransition !== record || outcome.kind === 'cancelled') {
      this.#reportTransitionRendererOutcome(record, outcome);
      return commandOutcome({
        commandId,
        command: resolution.command,
        result: EVENT_RESULT.CANCELLED,
        fromStepId: resolution.fromStepId,
        toStepId: targetStepId,
        reason: record.cancelReason ?? 'navigation',
        transitionId
      });
    }

    if (outcome.kind === 'error') {
      this.#reportTransitionRendererOutcome(record, outcome);
      this.#eventControl.emit({
        component: EVENT_COMPONENT.RUNTIME,
        event: EVENT_NAME.TRANSITION_FAILED,
        result: EVENT_RESULT.FAILED,
        command_id: commandId,
        transition_id: transitionId,
        from_step: resolution.fromStepId,
        to_step: targetStepId
      });
      this.#controls.semanticControl.abandonTarget(targetStepId);
      this.#clearActiveTransition(record);
      this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);
      throw outcome.error;
    }

    this.#eventControl.emit({
      component: EVENT_COMPONENT.RENDERER,
      event: EVENT_NAME.RENDERER_SETTLED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      transition_id: transitionId,
      step_id: targetStepId
    });
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.TRANSITION_SETTLED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      transition_id: transitionId,
      from_step: resolution.fromStepId,
      to_step: targetStepId
    });

    const beforeCommit = this.#session.read.snapshot();
    const afterCommit = resolution.command === NAVIGATION_COMMAND.RESTART
      ? this.#controls.semanticControl.commitRestart()
      : this.#controls.semanticControl.commitTarget(targetStepId);

    this.#clearActiveTransition(record);
    this.#controls.statusControl.setStatus(SESSION_STATUS.IDLE);

    if (beforeCommit.currentStepId !== afterCommit.currentStepId) {
      this.#eventControl.emit({
        component: EVENT_COMPONENT.CORE,
        event: EVENT_NAME.STEP_CHANGED,
        result: EVENT_RESULT.SUCCESS,
        command_id: commandId,
        transition_id: transitionId,
        from_step: beforeCommit.currentStepId,
        to_step: afterCommit.currentStepId,
        step_id: afterCommit.currentStepId
      });
    }

    return commandOutcome({
      commandId,
      command: resolution.command,
      result: resolution.result,
      fromStepId: resolution.fromStepId,
      toStepId: targetStepId,
      reason: resolution.reason,
      transitionId
    });
  }

  async #cancelActiveTransition(reason) {
    const record = this.#activeTransition;
    if (!record) return false;

    record.cancelled = true;
    record.cancelReason = reason;

    if (
      this.#operational.activeAbortState !== null &&
      this.#operational.activeAbortState.transitionId === record.transitionId
    ) {
      this.#operational.activeAbortState = Object.freeze({
        transitionId: record.transitionId,
        aborted: true,
        reason
      });
    }

    record.capabilities.abort.controller.abort(reason);
    record.capabilities.clock.controller.revoke();

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

    const outcome = await record.renderDone;
    this.#reportTransitionRendererOutcome(record, outcome);
    this.#clearActiveTransition(record);
    return true;
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

  #emitRendererOutcome({
    transitionId,
    commandId,
    fromStepId,
    toStepId
  }, outcome) {
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

  #createRenderCapabilities(transitionId) {
    return Object.freeze({
      abort: createRendererAbortCapability(),
      clock: createRendererClockCapability({
        transitionId,
        scheduler: this.#scheduler
      })
    });
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

  #stopPlaybackForNavigation(commandId, command, source) {
    this.#operational.dwellRemainingMs = 0;
    if (!this.#operational.playbackIntent) return;

    this.#operational.playbackIntent = false;
    this.#eventControl.emit({
      component: EVENT_COMPONENT.RUNTIME,
      event: EVENT_NAME.PLAYBACK_STOPPED,
      result: EVENT_RESULT.SUCCESS,
      command_id: commandId,
      details: {
        reason: command === NAVIGATION_COMMAND.RESTART ? 'restart' : 'navigation',
        source
      }
    });
  }
}

export function createCiMInstance(options) {
  if (!isPlainObject(options)) fail('createCiMInstance options must be a plain object.');

  const descriptors = Object.getOwnPropertyDescriptors(options);
  const readRequired = (key) => {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(`createCiMInstance options.${key} must be an enumerable data property.`);
    }
    return descriptor.value;
  };
  const readOptional = (key, fallback) => {
    const descriptor = descriptors[key];
    if (!descriptor) return fallback;
    if (!descriptor.enumerable || !('value' in descriptor)) {
      fail(`createCiMInstance options.${key} must be an enumerable data property when present.`);
    }
    return descriptor.value;
  };

  return new CiMInstance({
    instanceId: readRequired('instanceId'),
    experience: readRequired('experience'),
    clock: readRequired('clock'),
    renderer: readOptional('renderer', null),
    rendererRoot: readOptional('rendererRoot', null),
    reducedMotion: readOptional('reducedMotion', false)
  });
}
