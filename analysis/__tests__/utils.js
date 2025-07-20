'use strict';

const TagMap = {
  0: 'FunctionComponent',
  1: 'ClassComponent',
  3: 'HostRoot', // Root of a host tree. Could be nested inside another node.
  4: 'HostPortal', // A subtree. Could be an entry point to a different renderer.
  5: 'HostComponent',
  6: 'HostText',
  7: 'Fragment',
  8: 'Mode',
  9: 'ContextConsumer',
  10: 'ContextProvider',
  11: 'ForwardRef',
  12: 'Profiler',
  13: 'SuspenseComponent',
  14: 'MemoComponent',
  15: 'SimpleMemoComponent',
  16: 'LazyComponent',
  17: 'IncompleteClassComponent',
  18: 'DehydratedFragment',
  19: 'SuspenseListComponent',
  21: 'ScopeComponent',
  22: 'OffscreenComponent',
  23: 'LegacyHiddenComponent',
  24: 'CacheComponent',
  25: 'TracingMarkerComponent',
  26: 'HostHoistable',
  27: 'HostSingleton',
  28: 'IncompleteFunctionComponent',
  29: 'Throw',
};

export const tag = (tag) => {
  return TagMap[tag] || 'Unknown';
};

const ModeMap = {
  0b0000000: 'NoMode',
  0b0000001: 'ConcurrentMode',
  0b0000010: 'ProfileMode',
  0b0000100: 'DebugTracingMode',
  0b0001000: 'StrictLegacyMode',
  0b0010000: 'StrictEffectsMode',
  0b1000000: 'NoStrictPassiveEffectsMode',
};
const getModeAsString = (modes) => {
  if (modes === 0) return 'NoMode';

  const setModes = [];
  // eslint-disable-next-line
  for (const [binStr, modeName] of Object.entries(ModeMap)) {
    const binNum = +binStr;
    if (modes & binNum) {
      setModes.push(modeName);
    }
  }

  return setModes.join(',');
};

const FLAGS = {
  '0b0000000000000000000000000000': 'NoFlags',
  '0b0000000000000000000000000001': 'PerformedWork',
  '0b0000000000000000000000000010': 'Placement',
  '0b0000000000000000000010000000': 'DidCapture',
  '0b0000000000000001000000000000': 'Hydrating',
  '0b0000000000000000000000000100': 'Update',
  '0b0000000000000000000000001000': 'Cloned',
  '0b0000000000000000000000010000': 'ChildDeletion',
  '0b0000000000000000000000100000': 'ContentReset',
  '0b0000000000000000000001000000': 'Callback',
  '0b0000000000000000000100000000': 'ForceClientRender',
  '0b0000000000000000001000000000': 'Ref',
  '0b0000000000000000010000000000': 'Snapshot',
  '0b0000000000000000100000000000': 'Passive',
  '0b0000000000000010000000000000': 'Visibility',
  '0b0000000000000100000000000000': 'StoreConsistency',
  '0b0000000000000111111111111111': 'HostEffectMask',
  '0b0000000000001000000000000000': 'Incomplete',
  '0b0000000000010000000000000000': 'ShouldCapture',
  '0b0000000000100000000000000000': 'ForceUpdateForLegacySuspense',
  '0b0000000001000000000000000000': 'DidPropagateContext',
  '0b0000000010000000000000000000': 'NeedsPropagation',
  '0b0000000100000000000000000000': 'Forked',
  '0b0000001000000000000000000000': 'RefStatic',
  '0b0000010000000000000000000000': 'LayoutStatic',
  '0b0000100000000000000000000000': 'PassiveStatic',
  '0b0001000000000000000000000000': 'MaySuspendCommit',
  '0b0010000000000000000000000000': 'PlacementDEV',
  '0b0100000000000000000000000000': 'MountLayoutDev',
  '0b1000000000000000000000000000': 'MountPassiveDev',
};
const getFlagsAsString = (flags) => {
  if (flags === 0) return 'NoFlags';
  const setFlags = [];

  // eslint-disable-next-line
  for (const [binStr, flagName] of Object.entries(FLAGS)) {
    const binNum = +binStr;
    if (flags & binNum) {
      setFlags.push(flagName);
    }
  }

  return setFlags.join(',');
};

const LANES = {
  0b0000000000000000000000000000000: 'NoLane',
  0b0000000000000000000000000000001: 'SyncHydrationLane',
  0b0000000000000000000000000000010: 'SyncLane',
  0b0000000000000000000000000000100: 'InputContinuousHydrationLane',
  0b0000000000000000000000000001000: 'InputContinuousLane',
  0b0000000000000000000000000010000: 'DefaultHydrationLane',
  0b0000000000000000000000000100000: 'DefaultLane',
  0b0000000000000000000000001000000: 'TransitionHydrationLane',
  0b0000000001111111111111110000000: 'TransitionLanes',
  0b0000000000000000000000010000000: 'TransitionLane1',
  0b0000000000000000000000100000000: 'TransitionLane2',
  0b0000000000000000000001000000000: 'TransitionLane3',
  0b0000000000000000000010000000000: 'TransitionLane4',
  0b0000000000000000000100000000000: 'TransitionLane5',
  0b0000000000000000001000000000000: 'TransitionLane6',
  0b0000000000000000010000000000000: 'TransitionLane7',
  0b0000000000000000100000000000000: 'TransitionLane8',
  0b0000000000000001000000000000000: 'TransitionLane9',
  0b0000000000000010000000000000000: 'TransitionLane10',
  0b0000000000000100000000000000000: 'TransitionLane11',
  0b0000000000001000000000000000000: 'TransitionLane12',
  0b0000000000010000000000000000000: 'TransitionLane13',
  0b0000000000100000000000000000000: 'TransitionLane14',
  0b0000000001000000000000000000000: 'TransitionLane15',
  0b0000011110000000000000000000000: 'RetryLanes',
  0b0000000010000000000000000000000: 'RetryLane1',
  0b0000000100000000000000000000000: 'RetryLane2',
  0b0000001000000000000000000000000: 'RetryLane3',
  0b0000010000000000000000000000000: 'RetryLane4',
  0b0000100000000000000000000000000: 'SelectiveHydrationLane',
  0b0000111111111111111111111111111: 'NonIdleLanes',
  0b0001000000000000000000000000000: 'IdleHydrationLane',
  0b0010000000000000000000000000000: 'IdleLane',
  0b0100000000000000000000000000000: 'OffscreenLane',
  0b1000000000000000000000000000000: 'DeferredLane',
};

const getLanesAsString = (lanes) => {
  if (lanes === 0) return 'NoLane';
  const setLanes = [];

  // eslint-disable-next-line
  for (const [binStr, lanesName] of Object.entries(LANES)) {
    const binNum = +binStr;
    if (lanes & binNum) {
      setLanes.push(lanesName);
    }
  }

  return setLanes.join(',');
};

export const propertyMapConvert = {
  tag: (val) => `${val}: ${tag(val)}`,
  mode: (val) => `${val}: ${getModeAsString(val)}`,
  flags: (val) => `${val}: ${getFlagsAsString(val)}`,
  subtreeFlags: (val) => `${val}: ${getFlagsAsString(val)}`,
  lanes: (val) => `${val}: ${getLanesAsString(val)}`,
  childLanes: (val) => `${val}: ${getLanesAsString(val)}`,
  other: (value) => value,
};
