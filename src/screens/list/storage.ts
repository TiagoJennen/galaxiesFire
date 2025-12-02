import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { Todo } from "./types";

const FIRESTORE_DB = getFirestore();

// Zorgt dat alle optionele fields altijd een waarde hebben (null als ze ontbreken)
const normalizeTodo = (todo: Todo): Todo => ({
  ...todo,
  deadline: todo.deadline || null,
  createdAt: todo.createdAt || null,
  priority: todo.priority || null,
  image: todo.image || null,
  location: todo.location || null,

  // Subtaken ook normaliseren zodat Firestore geen undefined waarden krijgt
  subtasks: todo.subtasks.map((sub) => ({
    ...sub,
    deadline: sub.deadline || null,
    createdAt: sub.createdAt || null,
    image: sub.image || null,
    priority: sub.priority || null,
    location: sub.location || null,
  })),
});

// Slaat todos en archief op in Firestore onder de userId
export const saveTodosFirebase = async (
  userId: string,
  todosData: Todo[],
  archivedData: Todo[]
) => {
  try {
    // Voorkomen dat undefined waarden worden opgeslagen
    const cleanTodos = todosData.map(normalizeTodo);
    const cleanArchived = archivedData.map(normalizeTodo);

    // Verwijzing naar document van de gebruiker
    const userRef = doc(FIRESTORE_DB, "users", userId);

    // Document opslaan of overschrijven
    await setDoc(userRef, { todos: cleanTodos, archive: cleanArchived });
  } catch (error) {
    console.log("Fout bij opslaan naar Firebase:", error);
  }
};

// Haalt todos en archief op uit Firestore
export const loadTodosFirebase = async (userId: string) => {
  try {
    const userRef = doc(FIRESTORE_DB, "users", userId);
    const docSnap = await getDoc(userRef);

    // Check of gebruiker al data heeft
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Altijd lijsten teruggeven
      return { todos: data.todos || [], archive: data.archive || [] };
    }

    // Nieuwe gebruiker → lege lijsten
    return { todos: [], archive: [] };
  } catch (error) {
    console.log("Fout bij laden vanuit Firebase:", error);
    return { todos: [], archive: [] };
  }
};
