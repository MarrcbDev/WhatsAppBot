import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

// Inicializa la base de datos
let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initDB() {
    db = await open({
        filename: "./users.db",
        driver: sqlite3.Database,
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE
        )
    `);
}

// Función para registrar un usuario
export async function registerUser(phone: string): Promise<boolean> {
    try {
        await db.run("INSERT INTO users (phone) VALUES (?)", [phone]);
        return true;
    } catch (error) {
        return false;
    }
}

// Función para verificar si un usuario está registrado
export async function isUserRegistered(phone: string): Promise<boolean> {
    const user = await db.get("SELECT phone FROM users WHERE phone = ?", [phone]);
    return !!user;
}

// Función para obtener todos los usuarios registrados
export async function getRegisteredUsers(): Promise<string[]> {
    const users = await db.all("SELECT phone FROM users");
    return users.map((user: any) => user.phone);
}
