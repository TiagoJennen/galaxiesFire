import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { Todo } from "./types";

const FIRESTORE_DB = getFirestore();

const normalizeTodo = (todo: Todo): Todo => ({
  ...todo,
  deadline: todo.deadline || null,
  createdAt: todo.createdAt || null,
  priority: todo.priority || null,
  image: todo.image || null,
  location: todo.location || null,
  subtasks: todo.subtasks.map((sub) => ({
    ...sub,
    deadline: sub.deadline || null,
    createdAt: sub.createdAt || null,
    image: sub.image || null,
    priority: sub.priority || null,
  })),
});

export const saveTodosFirebase = async (
  userId: string,
  todosData: Todo[],
  archivedData: Todo[]
) => {
  try {
    const cleanTodos = todosData.map(normalizeTodo);
    const cleanArchived = archivedData.map(normalizeTodo);
    const userRef = doc(FIRESTORE_DB, "users", userId);
    await setDoc(userRef, { todos: cleanTodos, archive: cleanArchived });
  } catch (error) {
    console.log("Fout bij opslaan naar Firebase:", error);
  }
};

export const loadTodosFirebase = async (userId: string) => {
  try {
    const userRef = doc(FIRESTORE_DB, "users", userId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { todos: data.todos || [], archive: data.archive || [] };
    }
    return { todos: [], archive: [] };
  } catch (error) {
    console.log("Fout bij laden vanuit Firebase:", error);
    return { todos: [], archive: [] };
  }
};
