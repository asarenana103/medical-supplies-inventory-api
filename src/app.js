const cors = require('cors');
const express = require('express');

const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const indexRoutes = require('./routes/indexRoutes');
const productRoutes = require('./routes/productRoutes');
const reportRoutes = require('./routes/reportRoutes');
const salesRoutes = require('./routes/salesRoutes');
const stockRoutes = require('./routes/stockRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', indexRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/stock', stockRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
