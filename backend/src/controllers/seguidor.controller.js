import sql from "mssql";
import { pool } from "../config/db.js";

export const seguirUsuario = async (req, res) => {
  const { id_seguidor, id_seguido } = req.body;
  if (!id_seguidor || !id_seguido) return res.status(400).json({ error: "Faltan datos" });
  if (id_seguidor === id_seguido) return res.status(400).json({ error: "No puedes seguirte a ti mismo" });
  try {
    const conn = await pool;
    const existe = await conn.request()
      .input("id_seguidor", sql.Int, id_seguidor)
      .input("id_seguido",  sql.Int, id_seguido)
      .query("SELECT 1 FROM seguidores WHERE id_seguidor = @id_seguidor AND id_seguido = @id_seguido");
    if (existe.recordset.length > 0) return res.status(409).json({ error: "Ya sigues a este usuario" });
    await conn.request()
      .input("id_seguidor", sql.Int, id_seguidor)
      .input("id_seguido",  sql.Int, id_seguido)
      .query("INSERT INTO seguidores (id_seguidor, id_seguido) VALUES (@id_seguidor, @id_seguido)");
    res.status(201).json({ ok: true, message: "Ahora sigues a este usuario" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const dejarDeSeguir = async (req, res) => {
  const { id_seguidor, id_seguido } = req.body;
  if (!id_seguidor || !id_seguido) return res.status(400).json({ error: "Faltan datos" });
  try {
    const conn = await pool;
    await conn.request()
      .input("id_seguidor", sql.Int, id_seguidor)
      .input("id_seguido",  sql.Int, id_seguido)
      .query("DELETE FROM seguidores WHERE id_seguidor = @id_seguidor AND id_seguido = @id_seguido");
    res.json({ ok: true, message: "Dejaste de seguir a este usuario" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const estadoSeguimiento = async (req, res) => {
  const { seguidor, seguido } = req.query;
  if (!seguidor || !seguido) return res.status(400).json({ error: "Faltan parametros" });
  try {
    const conn = await pool;
    const result = await conn.request()
      .input("id_seguidor", sql.Int, Number(seguidor))
      .input("id_seguido",  sql.Int, Number(seguido))
      .query("SELECT COUNT(*) AS total FROM seguidores WHERE id_seguidor = @id_seguidor AND id_seguido = @id_seguido");
    res.json({ sigues: result.recordset[0].total > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
