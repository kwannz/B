import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { PersistOptions, persist } from 'zustand/middleware';

type ConfigurePersist = <
  T extends unknown,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs>,
  options: PersistOptions<T>
) => StateCreator<T, Mps, Mcs>;

export const configurePersist: ConfigurePersist = (config, options) => (set, get, api) =>
  persist(config, options)(set, get, api);
