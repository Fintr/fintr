import { createClient } from "@supabase/supabase-js";

// Mock supabase client that maintains the interface
export const supabase = {
  from: (table: string) => ({
    select: (columns: string[] | string) => {
      const baseResponse = {
        eq: (column: string, value: any) => ({
          single: () => Promise.resolve({ data: null, error: null }),
          order: (column: string, options: any) => Promise.resolve({ data: [], error: null }),
          delete: () => Promise.resolve({ data: null, error: null }),
          update: (data: any) => ({
            eq: (column: string, value: any) => ({
              select: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          insert: (items: any) => ({
            select: () => Promise.resolve({ data: [items[0]], error: null }),
          }),
          gte: (column: string, value: any) => ({
            lte: (column: string, value: any) => Promise.resolve({ data: [], error: null }),
            order: (column: string, options: any) => Promise.resolve({ data: [], error: null }),
          }),
          lt: (column: string, value: any) => ({
            gte: (column: string, value: any) => ({
              lte: (column: string, value: any) => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
        order: (column: string, options: any) => Promise.resolve({ data: [], error: null }),
        gte: (column: string, value: any) => ({
          lte: (column: string, value: any) => Promise.resolve({ data: [], error: null }),
          order: (column: string, options: any) => Promise.resolve({ data: [], error: null }),
        }),
        lt: (column: string, value: any) => ({
          gte: (column: string, value: any) => ({
            lte: (column: string, value: any) => Promise.resolve({ data: [], error: null }),
          }),
        }),
        lte: (column: string, value: any) => Promise.resolve({ data: [], error: null }),
      };
      return baseResponse;
    },
    insert: (items: any) => ({
      select: () => Promise.resolve({ data: [items[0]], error: null }),
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        select: () => Promise.resolve({ data: [data], error: null }),
      }),
    }),
    delete: () => ({
      eq: (column: string, value: any) => Promise.resolve({ data: null, error: null }),
    }),
  }),
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
  },
};
