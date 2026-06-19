const database = require('../utils/db');
const { sendCreated, sendSuccess } = require('../utils/responses');

function validateSupplierPayload(payload, isUpdate = false) {
  const errors = [];

  if (!isUpdate || payload.name !== undefined) {
    if (!payload.name || String(payload.name).trim() === '') {
      errors.push('Supplier name is required.');
    }
  }

  if (payload.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(payload.email)) {
      errors.push('Supplier email must be valid.');
    }
  }

  return errors;
}

function normalizeSupplierPayload(payload) {
  return {
    name: payload.name ? String(payload.name).trim() : payload.name,
    phone: payload.phone ? String(payload.phone).trim() : null,
    email: payload.email ? String(payload.email).trim().toLowerCase() : null,
    address: payload.address ? String(payload.address).trim() : null
  };
}

async function getSupplierById(id) {
  return database.get('SELECT * FROM suppliers WHERE id = ?', [id]);
}

async function listSuppliers(req, res, next) {
  try {
    const params = [];
    let whereClause = '';

    if (req.query.search) {
      whereClause = 'WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?';
      params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`);
    }

    const suppliers = await database.all(
      `SELECT * FROM suppliers ${whereClause} ORDER BY created_at DESC, id DESC`,
      params
    );

    return sendSuccess(res, 'Suppliers retrieved successfully', suppliers);
  } catch (error) {
    return next(error);
  }
}

async function getSupplier(req, res, next) {
  try {
    const supplier = await getSupplierById(req.params.id);

    if (!supplier) {
      res.status(404);
      throw new Error('Supplier not found');
    }

    return sendSuccess(res, 'Supplier retrieved successfully', supplier);
  } catch (error) {
    return next(error);
  }
}

async function createSupplier(req, res, next) {
  try {
    const errors = validateSupplierPayload(req.body);

    if (errors.length) {
      res.status(400);
      throw new Error(errors.join(' '));
    }

    const supplier = normalizeSupplierPayload(req.body);
    const result = await database.run(
      `INSERT INTO suppliers (name, phone, email, address)
      VALUES (?, ?, ?, ?)`,
      [supplier.name, supplier.phone, supplier.email, supplier.address]
    );

    const createdSupplier = await getSupplierById(result.id);
    return sendCreated(res, 'Supplier added successfully', createdSupplier);
  } catch (error) {
    return next(error);
  }
}

async function updateSupplier(req, res, next) {
  try {
    const existingSupplier = await getSupplierById(req.params.id);

    if (!existingSupplier) {
      res.status(404);
      throw new Error('Supplier not found');
    }

    const errors = validateSupplierPayload(req.body, true);

    if (errors.length) {
      res.status(400);
      throw new Error(errors.join(' '));
    }

    const supplier = normalizeSupplierPayload({
      ...existingSupplier,
      ...req.body
    });

    await database.run(
      `UPDATE suppliers
      SET name = ?, phone = ?, email = ?, address = ?
      WHERE id = ?`,
      [supplier.name, supplier.phone, supplier.email, supplier.address, req.params.id]
    );

    const updatedSupplier = await getSupplierById(req.params.id);
    return sendSuccess(res, 'Supplier updated successfully', updatedSupplier);
  } catch (error) {
    return next(error);
  }
}

async function deleteSupplier(req, res, next) {
  try {
    const existingSupplier = await getSupplierById(req.params.id);

    if (!existingSupplier) {
      res.status(404);
      throw new Error('Supplier not found');
    }

    await database.run('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    return sendSuccess(res, 'Supplier deleted successfully');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier
};
