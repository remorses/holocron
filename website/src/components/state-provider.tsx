"use client";
import { createContext, useState } from "react";
import { create } from "zustand";
import { chatStateContainer, State, useChatState, zustandContext } from "website/src/lib/state";


export function StateProvider({
  value,
  children,
}: {
  value: State;
  children: React.ReactNode;
}) {
  const [useChatState] = useState(() => {
    const store = create<State>(() => value);
    chatStateContainer.current = store;
    return store;
  });

  return (
    <zustandContext.Provider value={useChatState}>
      {children}
    </zustandContext.Provider>
  );
}
