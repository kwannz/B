import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { useToast } from '../../components/ui/use-toast';

type Logger = <
  T extends unknown,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string
) => StateCreator<T, Mps, Mcs>;

type LoggerImpl = <T extends unknown>(
  f: StateCreator<T, [], []>,
  name?: string
) => StateCreator<T, [], []>;

const loggerImpl: LoggerImpl = (f, name) => (set, get, store) => {
  type T = ReturnType<typeof f>;
  const loggedSet: typeof set = (...a) => {
    const before = get();
    try {
      set(...a);
      const after = get();
      console.group(`State Update: ${name || 'store'}`);
      console.log('Previous:', before);
      console.log('Next:', after);
      console.log('Action:', a[0]);
      console.groupEnd();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      console.error(`Error in ${name || 'store'} update:`, error);
      const { toast } = useToast(); toast({
        variant: "destructive",
        title: "Store Update Error",
        description: errorMessage,
      });
      throw error;
    }
  };

  store.setState = loggedSet;

  return f(loggedSet, get, store);
};

export const logger = loggerImpl as unknown as Logger;
