import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@canli-quiz/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: QuizSocket = io(SERVER_URL, { autoConnect: false });
