/**
 * Mock Auth Store — Quản lý users với file persistence
 * Lưu users vào data/users.json để không mất khi restart
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface MockUser {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
    avatarUrl?: string;
    walletBalance: number;
    termsAcceptedAt: string;
    createdAt: string;
}

interface StoredUser extends MockUser {
    passwordHash: string;
}

// ==================== FILE PERSISTENCE ====================
const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function hashPw(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

// Default admin — always exists
const DEFAULT_ADMIN: StoredUser = {
    id: 'user_admin',
    username: 'admin',
    email: 'admin@chotainguyen.vn',
    fullName: 'Admin CTN',
    role: 'SUPER_ADMIN',
    walletBalance: 0,
    passwordHash: hashPw('Admin@123'),
    termsAcceptedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
};

function loadUsers(): StoredUser[] {
    try {
        ensureDataDir();
        if (fs.existsSync(USERS_FILE)) {
            const raw = fs.readFileSync(USERS_FILE, 'utf-8');
            const users: StoredUser[] = JSON.parse(raw);
            // Ensure admin always exists
            if (!users.find(u => u.id === 'user_admin')) {
                users.unshift(DEFAULT_ADMIN);
            }
            return users;
        }
    } catch (e) {
        console.error('Failed to load users:', e);
    }
    return [DEFAULT_ADMIN];
}

function saveUsers() {
    try {
        ensureDataDir();
        fs.writeFileSync(USERS_FILE, JSON.stringify(serverUsers, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to save users:', e);
    }
}

// Initialize from file
let serverUsers: StoredUser[] = loadUsers();

// ==================== CRUD ====================

export function getAllMockUsers() {
    return serverUsers;
}

export function findMockUserByUsername(username: string) {
    return serverUsers.find(u => u.username === username);
}

export function findMockUserByEmail(email: string) {
    return serverUsers.find(u => u.email === email);
}

export function findMockUserById(id: string) {
    return serverUsers.find(u => u.id === id);
}

export function createMockUser(data: {
    username: string;
    email: string;
    fullName: string;
    password: string;
}): MockUser {
    const newUser: StoredUser = {
        id: `user_${Date.now()}`,
        username: data.username,
        email: data.email,
        fullName: data.fullName,
        role: 'USER',
        walletBalance: 0,
        passwordHash: hashPw(data.password),
        termsAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
    };
    serverUsers.push(newUser);
    saveUsers();
    return newUser;
}

export function verifyMockPassword(username: string, password: string): boolean {
    const user = findMockUserByUsername(username);
    if (!user) return false;
    // Support both hashed and legacy plain-text passwords
    return user.passwordHash === hashPw(password) || user.passwordHash === password;
}

export function updateUserRole(userId: string, newRole: string): boolean {
    const user = serverUsers.find(u => u.id === userId);
    if (user) {
        user.role = newRole;
        saveUsers();
        return true;
    }
    return false;
}

export function updateUserBalance(userId: string, newBalance: number): boolean {
    const user = serverUsers.find(u => u.id === userId);
    if (user) {
        user.walletBalance = newBalance;
        saveUsers();
        return true;
    }
    return false;
}

export function deleteMockUser(userId: string): boolean {
    const idx = serverUsers.findIndex(u => u.id === userId);
    if (idx < 0) return false;
    // Don't allow deleting the admin
    if (serverUsers[idx].role === 'SUPER_ADMIN') return false;
    serverUsers.splice(idx, 1);
    saveUsers();
    return true;
}
