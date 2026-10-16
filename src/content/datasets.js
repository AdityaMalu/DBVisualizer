/* Datasets the examples and exercises run against (SQLite). Small on purpose, so every result fits on screen.
   Each run starts from a fresh copy. Dates are ISO text, money is REAL. */

dataset('shop', 'an online shop: customers, products, orders, order_items, logins', `
CREATE TABLE customers (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  city    TEXT,
  email   TEXT UNIQUE,
  joined  TEXT NOT NULL
);
CREATE TABLE products (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  category  TEXT NOT NULL,
  price     REAL NOT NULL CHECK (price >= 0)
);
CREATE TABLE orders (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  order_date   TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('placed','shipped','delivered','cancelled'))
);
CREATE TABLE order_items (
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  product_id  INTEGER NOT NULL REFERENCES products(id),
  qty         INTEGER NOT NULL CHECK (qty > 0),
  unit_price  REAL NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
CREATE TABLE logins (
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  login_date   TEXT NOT NULL,
  PRIMARY KEY (customer_id, login_date)
);
INSERT INTO customers VALUES
 (1,'Asha','Pune','asha@mail.com','2023-01-10'),
 (2,'Ben','Mumbai','ben@mail.com','2023-02-14'),
 (3,'Chen','Pune','chen@mail.com','2023-03-01'),
 (4,'Diya','Delhi',NULL,'2023-05-20'),
 (5,'Eli','Mumbai','eli@mail.com','2023-07-07'),
 (6,'Farah',NULL,'farah@mail.com','2024-01-03'),
 (7,'Gopal','Delhi','gopal@mail.com','2024-02-11');
INSERT INTO products VALUES
 (1,'Laptop','electronics',900),
 (2,'Phone','electronics',600),
 (3,'Headphones','electronics',120),
 (4,'Desk','furniture',250),
 (5,'Chair','furniture',150),
 (6,'Lamp','furniture',40),
 (7,'Novel','books',15),
 (8,'Cookbook','books',30);
INSERT INTO orders VALUES
 (101,1,'2024-01-05','delivered'),
 (102,2,'2024-01-09','delivered'),
 (103,1,'2024-02-02','shipped'),
 (104,3,'2024-02-15','delivered'),
 (105,5,'2024-02-20','cancelled'),
 (106,2,'2024-03-01','delivered'),
 (107,3,'2024-03-03','placed'),
 (108,1,'2024-03-18','delivered'),
 (109,7,'2024-03-21','shipped'),
 (110,5,'2024-04-02','delivered');
INSERT INTO order_items VALUES
 (101,1,1,900),(101,3,2,110),
 (102,2,1,600),(102,7,3,15),
 (103,4,1,250),(103,5,2,150),
 (104,7,2,15),(104,8,1,30),
 (105,2,1,600),
 (106,3,1,120),(106,6,2,40),
 (107,1,1,880),
 (108,5,4,140),(108,6,1,40),
 (109,8,2,30),
 (110,2,2,590),(110,3,1,120);
INSERT INTO logins VALUES
 (1,'2024-03-01'),(1,'2024-03-02'),(1,'2024-03-03'),(1,'2024-03-05'),(1,'2024-03-06'),
 (2,'2024-03-01'),(2,'2024-03-03'),
 (3,'2024-03-02'),(3,'2024-03-03'),(3,'2024-03-04'),(3,'2024-03-05'),
 (5,'2024-03-04');
`);

dataset('hr', 'a company: departments and employees with managers', `
CREATE TABLE departments (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  location  TEXT
);
CREATE TABLE employees (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  dept_id     INTEGER REFERENCES departments(id),
  manager_id  INTEGER REFERENCES employees(id),
  title       TEXT,
  salary      INTEGER NOT NULL,
  hired       TEXT NOT NULL
);
INSERT INTO departments VALUES
 (1,'Engineering','Pune'),(2,'Sales','Mumbai'),(3,'HR','Pune'),(4,'Legal',NULL);
INSERT INTO employees VALUES
 (1,'Meera',1,NULL,'CTO',250000,'2018-04-01'),
 (2,'Arjun',1,1,'Eng Manager',180000,'2019-06-15'),
 (3,'Kiran',1,2,'Senior Engineer',150000,'2020-01-10'),
 (4,'Lena',1,2,'Engineer',110000,'2021-08-23'),
 (5,'Omar',1,2,'Engineer',110000,'2022-02-01'),
 (6,'Priya',2,1,'Sales Head',160000,'2019-03-11'),
 (7,'Ravi',2,6,'Account Exec',90000,'2021-05-05'),
 (8,'Sara',2,6,'Account Exec',95000,'2022-09-19'),
 (9,'Tom',3,1,'HR Lead',100000,'2020-11-30'),
 (10,'Uma',3,9,'Recruiter',70000,'2023-01-16'),
 (11,'Vikram',NULL,NULL,'Contractor',60000,'2023-06-01');
`);

dataset('bank', 'a bank: accounts and transfers', `
CREATE TABLE accounts (
  id       INTEGER PRIMARY KEY,
  owner    TEXT NOT NULL,
  branch   TEXT NOT NULL,
  balance  REAL NOT NULL CHECK (balance >= 0),
  version  INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE transfers (
  id       INTEGER PRIMARY KEY,
  from_id  INTEGER NOT NULL REFERENCES accounts(id),
  to_id    INTEGER NOT NULL REFERENCES accounts(id),
  amount   REAL NOT NULL CHECK (amount > 0),
  ts       TEXT NOT NULL
);
INSERT INTO accounts (id, owner, branch, balance) VALUES
 (1,'Asha','PUNE',100),(2,'Ben','PUNE',250),(3,'Chen','MUMBAI',75),(4,'Diya','PUNE',0),(5,'Eli','MUMBAI',500);
INSERT INTO transfers VALUES
 (1,2,1,50,'2024-03-01 09:00'),(2,5,3,25,'2024-03-01 10:30'),(3,1,4,20,'2024-03-02 11:00'),
 (4,5,2,100,'2024-03-03 12:15'),(5,2,3,30,'2024-03-04 08:45');
`);

dataset('school', 'a university: students, courses, enrollments', `
CREATE TABLE students (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  major  TEXT,
  year   INTEGER CHECK (year BETWEEN 1 AND 4)
);
CREATE TABLE courses (
  code        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  instructor  TEXT NOT NULL,
  credits     INTEGER NOT NULL
);
CREATE TABLE enrollments (
  student_id   INTEGER REFERENCES students(id),
  course_code  TEXT REFERENCES courses(code),
  grade        TEXT,
  PRIMARY KEY (student_id, course_code)
);
INSERT INTO students VALUES
 (1,'Aditi','CS',2),(2,'Bilal','CS',3),(3,'Carmen','Math',1),(4,'Dev','Physics',4),(5,'Esha','Math',2),(6,'Femi',NULL,1);
INSERT INTO courses VALUES
 ('CS101','Intro to Programming','Dr. Rao',4),('CS201','Databases','Dr. Iyer',4),('MA101','Calculus','Dr. Shah',3),('PH101','Mechanics','Dr. Shah',3),('CS301','Distributed Systems','Dr. Iyer',4);
INSERT INTO enrollments VALUES
 (1,'CS101','A'),(1,'CS201','B'),(1,'MA101','A'),
 (2,'CS201','A'),(2,'CS301',NULL),
 (3,'MA101','B'),(3,'CS101','C'),
 (4,'PH101','A'),(4,'MA101','B'),
 (5,'MA101','A'),(5,'CS201','B');
`);

dataset('flat', 'one denormalized spreadsheet of order lines (for normalization practice)', `
CREATE TABLE order_sheet (
  order_id       INTEGER,
  order_date     TEXT,
  customer_id    INTEGER,
  customer_name  TEXT,
  customer_city  TEXT,
  product_id     INTEGER,
  product_name   TEXT,
  category       TEXT,
  qty            INTEGER,
  unit_price     REAL,
  PRIMARY KEY (order_id, product_id)
);
INSERT INTO order_sheet VALUES
 (101,'2024-01-05',1,'Asha','Pune',1,'Laptop','electronics',1,900),
 (101,'2024-01-05',1,'Asha','Pune',3,'Headphones','electronics',2,110),
 (102,'2024-01-09',2,'Ben','Mumbai',2,'Phone','electronics',1,600),
 (102,'2024-01-09',2,'Ben','Mumbai',7,'Novel','books',3,15),
 (103,'2024-02-02',1,'Asha','Pune',4,'Desk','furniture',1,250),
 (103,'2024-02-02',1,'Asha','Pune',5,'Chair','furniture',2,150),
 (104,'2024-02-15',3,'Chen','Pune',7,'Novel','books',2,15),
 (104,'2024-02-15',3,'Chen','Pune',8,'Cookbook','books',1,30),
 (106,'2024-03-01',2,'Ben','Mumbay',3,'Headphones','electronics',1,120),
 (106,'2024-03-01',2,'Ben','Mumbai',6,'Lamp','furniture',2,40);
`);
