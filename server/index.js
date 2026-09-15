const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Basic test route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Render dynamically assigns PORT via environment variable
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});