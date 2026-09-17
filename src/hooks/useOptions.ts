import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { readList } from '../lib/utils';
import type { SelectOption } from '../lib/types';

export function useOptions(endpoint: string, refresh = 0) {
  const [options, setOptions] = useState<SelectOption[]>([]);
  useEffect(() => {
    api
      .get(endpoint)
      .then((res) => setOptions(readList<SelectOption>(res.data).items))
      .catch(() => setOptions([]));
  }, [endpoint, refresh]);
  return options;
}
