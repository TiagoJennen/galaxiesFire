// Hulptypen voor weergave-items die componenten in deze map gebruiken.
import type { SubTodo, Todo } from "../types";

export type DisplayTodo = {
  item: Todo;
  originalIndex: number;
};

export type DisplaySubtask = {
  sub: SubTodo;
  originalIndex: number;
};
