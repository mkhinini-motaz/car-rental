import { createContext } from "react";
import User from "../../classes/User";

// `user` is {} when nobody is signed in: check `user.id`.
const AuthContext = createContext<{ user: User, setUser: (user: User) => void, isRestoringSession: boolean }>({ user: {} as User, setUser: () => {}, isRestoringSession: true });

export default AuthContext;
