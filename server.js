const express = require("express");
const app = express();

app.use(express.json());

// ===== HEALTH CHECK =====
app.get("/api/health", (req, res) => {
  res.json({ status: "BookNook API is running 🚀" });
});

// ===== SAMPLE BOOKS (temporary in-memory) =====
let books = [];

// ===== GET ALL BOOKS =====
app.get("/api/books", (req, res) => {
  res.json(books);
});

// ===== ADD BOOK =====
app.post("/api/books", (req, res) => {
  const book = {
    id: books.length + 1,
    ...req.body,
  };

  books.push(book);

  res.json({
    message: "Book added successfully ✅",
    book,
  });
});

// ===== GET BOOK BY ID =====
app.get("/api/books/:id", (req, res) => {
  const book = books.find(b => b.id == req.params.id);
  res.json(book || { message: "Book not found" });
});

// ===== UPDATE BOOK =====
app.put("/api/books/:id", (req, res) => {
  const index = books.findIndex(b => b.id == req.params.id);

  if (index === -1) {
    return res.json({ message: "Book not found" });
  }

  books[index] = { ...books[index], ...req.body };

  res.json({
    message: "Book updated successfully ✅",
    book: books[index],
  });
});

// ===== DELETE BOOK =====
app.delete("/api/books/:id", (req, res) => {
  books = books.filter(b => b.id != req.params.id);

  res.json({ message: "Book deleted successfully ✅" });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`BookNook API running on port ${PORT}`);
});