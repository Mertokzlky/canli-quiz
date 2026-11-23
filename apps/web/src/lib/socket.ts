import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@canli-quiz/shared';
import { SERVER_URL } from './api';

export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: QuizSocket = io(SERVER_URL, { autoConnect: false });
