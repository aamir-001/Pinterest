-- Users table - stores basic user account information
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table - stores additional user information
CREATE TABLE Profiles (
    profile_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    profile_picture_url VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Boards table - represents pinboards created by users
CREATE TABLE Boards (
    board_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    board_name VARCHAR(100) NOT NULL,
    description TEXT,
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    friends_only_comments BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Image_Storage table - stores the actual image binary data
CREATE TABLE Image_Storage (
    image_id SERIAL PRIMARY KEY,
    image_data BYTEA NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pictures table - stores metadata about images
CREATE TABLE Pictures (
    picture_id SERIAL PRIMARY KEY,
    image_id INT NOT NULL,
    original_url VARCHAR(255),
    source_page_url VARCHAR(255),
    system_url VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES Image_Storage(image_id)
);

-- Tags table - keywords associated with pictures
CREATE TABLE Tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name VARCHAR(50) UNIQUE NOT NULL
);

-- Picture_Tags table - many-to-many relationship between pictures and tags
CREATE TABLE Picture_Tags (
    picture_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (picture_id, tag_id),
    FOREIGN KEY (picture_id) REFERENCES Pictures(picture_id),
    FOREIGN KEY (tag_id) REFERENCES Tags(tag_id)
);

-- Pins table - represents the act of pinning a picture to a board
CREATE TABLE Pins (
    pin_id SERIAL PRIMARY KEY,
    board_id INT NOT NULL,
    picture_id INT NOT NULL,
    user_id INT NOT NULL,
    original_pin_id INT,
    description TEXT,
    pin_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES Boards(board_id),
    FOREIGN KEY (picture_id) REFERENCES Pictures(picture_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (original_pin_id) REFERENCES Pins(pin_id) ON DELETE CASCADE
);

-- Likes table - tracks which users like which pictures
CREATE TABLE Likes (
    user_id INT NOT NULL,
    picture_id INT NOT NULL,  -- This is correct - likes are on pictures
    like_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, picture_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (picture_id) REFERENCES Pictures(picture_id)
);

-- Comments table - comments on pins (not pictures)
CREATE TABLE Comments (
    comment_id SERIAL PRIMARY KEY,
    pin_id INT NOT NULL,  -- This is correct - comments are on pins
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    comment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pin_id) REFERENCES Pins(pin_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- Create a type for friendship status
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted');

-- Friendships table - tracks friendship relationships
CREATE TABLE Friendships (
    friendship_id SERIAL PRIMARY KEY,
    user_id_1 INT NOT NULL,
    user_id_2 INT NOT NULL,
    status friendship_status NOT NULL,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acceptance_date TIMESTAMP,
    FOREIGN KEY (user_id_1) REFERENCES Users(user_id),
    FOREIGN KEY (user_id_2) REFERENCES Users(user_id),
    CHECK (user_id_1 < user_id_2)  -- Ensures unique friendships
);

-- Follow_Streams table - a collection of boards a user follows
CREATE TABLE Follow_Streams (
    stream_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    stream_name VARCHAR(100) NOT NULL,
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Stream_Contents table - boards included in a follow stream
CREATE TABLE Stream_Contents (
    stream_id INT NOT NULL,
    board_id INT NOT NULL,
    addition_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (stream_id, board_id),
    FOREIGN KEY (stream_id) REFERENCES Follow_Streams(stream_id) ON DELETE CASCADE,
    FOREIGN KEY (board_id) REFERENCES Boards(board_id) ON DELETE CASCADE
);


Sample data

-- Insert sample users
INSERT INTO Users (username, email, password_hash) VALUES
('Erica89', 'erica@example.com', 'hashed_password_1'),
('Timmy7', 'timmy@example.com', 'hashed_password_2'),
('JohnDoe', 'john@example.com', 'hashed_password_3'),
('SarahSmith', 'sarah@example.com', 'hashed_password_4'),
('ArtLover', 'artlover@example.com', 'hashed_password_5');

-- Insert profiles for users
INSERT INTO Profiles (user_id, display_name, bio, profile_picture_url) VALUES
(1, 'Erica', 'I love travel and antique furniture.', 'https://example.com/profiles/erica.jpg'),
(2, 'Timmy', 'I am 7 years old and I love dinosaurs and pirates!', 'https://example.com/profiles/timmy.jpg'),
(3, 'John', 'Photography enthusiast and nature lover', 'https://example.com/profiles/john.jpg'),
(4, 'Sarah', 'Food blogger and recipe creator', 'https://example.com/profiles/sarah.jpg'),
(5, 'Art Enthusiast', 'I appreciate all forms of art', 'https://example.com/profiles/art.jpg');

-- Insert boards for users
INSERT INTO Boards (user_id, board_name, description, friends_only_comments) VALUES
(1, 'Furniture', 'Beautiful antique furniture pieces', FALSE),
(1, 'Dream Vacations', 'Places I want to visit someday', TRUE),
(2, 'Super Dinosaurs', 'The coolest dinosaurs ever!', FALSE),
(2, 'Pirates', 'Arrrr! Pirate stuff', FALSE),
(3, 'Landscape Photography', 'Beautiful natural scenes', FALSE),
(3, 'Urban Architecture', 'Interesting buildings and structures', FALSE),
(4, 'Pasta Recipes', 'Delicious pasta dishes', TRUE),
(4, 'Desserts', 'Sweet treats and baking ideas', FALSE),
(5, 'Renaissance Art', 'Art from the Renaissance period', FALSE),
(5, 'Modern Sculptures', 'Contemporary sculptural works', FALSE);

-- Insert sample image data (using dummy bytea data)
INSERT INTO Image_Storage (image_data) VALUES
(decode('0123456789ABCDEF', 'hex')), -- Furniture image 1
(decode('FEDCBA9876543210', 'hex')), -- Vacation image 1
(decode('ABCDEF0123456789', 'hex')), -- Dinosaur image 1
(decode('9876543210FEDCBA', 'hex')), -- Pirate image 1
(decode('01AB23CD45EF6789', 'hex')), -- Landscape image 1
(decode('89AB67CD45EF0123', 'hex')), -- Architecture image 1
(decode('ABCD01234567EF89', 'hex')), -- Pasta image 1
(decode('EFAB89CD01234567', 'hex')), -- Dessert image 1
(decode('0123ABCD4567EFCD', 'hex')), -- Renaissance image 1
(decode('CDEF89AB01234567', 'hex')); -- Sculpture image 1

-- Insert pictures with metadata
INSERT INTO Pictures (image_id, original_url, source_page_url, system_url) VALUES
(1, 'https://antiques.com/sofa1.jpg', 'https://antiques.com/sofas', '/uploads/furniture1.jpg'),
(2, 'https://travel.com/beach1.jpg', 'https://travel.com/beaches', '/uploads/beach1.jpg'),
(3, 'https://dino.com/trex.jpg', 'https://dino.com/carnivores', '/uploads/dino1.jpg'),
(4, 'https://pirates.com/ship.jpg', 'https://pirates.com/vessels', '/uploads/pirate1.jpg'),
(5, 'https://nature.com/mountain.jpg', 'https://nature.com/mountains', '/uploads/landscape1.jpg'),
(6, 'https://architecture.com/skyscraper.jpg', 'https://architecture.com/buildings', '/uploads/building1.jpg'),
(7, 'https://food.com/pasta.jpg', 'https://food.com/italian', '/uploads/pasta1.jpg'),
(8, 'https://baking.com/cake.jpg', 'https://baking.com/desserts', '/uploads/dessert1.jpg'),
(9, 'https://art.com/monalisa.jpg', 'https://art.com/davinci', '/uploads/renaissance1.jpg'),
(10, 'https://modern-art.com/sculpture1.jpg', 'https://modern-art.com/modern', '/uploads/sculpture1.jpg');

-- Insert tags
INSERT INTO Tags (tag_name) VALUES
('antique'), ('furniture'), ('sofa'), ('travel'), ('beach'), ('vacation'),
('dinosaur'), ('t-rex'), ('pirate'), ('ship'), ('landscape'), ('mountain'),
('architecture'), ('skyscraper'), ('food'), ('pasta'), ('dessert'), ('cake'),
('renaissance'), ('art'), ('modern'), ('sculpture');

-- Link tags to pictures
INSERT INTO Picture_Tags (picture_id, tag_id) VALUES
(1, 1), (1, 2), (1, 3), -- Furniture tags
(2, 4), (2, 5), (2, 6), -- Beach tags
(3, 7), (3, 8), -- Dinosaur tags
(4, 9), (4, 10), -- Pirate tags
(5, 11), (5, 12), -- Landscape tags
(6, 13), (6, 14), -- Architecture tags
(7, 15), (7, 16), -- Pasta tags
(8, 15), (8, 17), (8, 18), -- Dessert tags
(9, 19), (9, 20), -- Renaissance art tags
(10, 20), (10, 21), (10, 22); -- Modern sculpture tags

-- Insert pins (original pins by users to their own boards)
INSERT INTO Pins (board_id, picture_id, user_id, description) VALUES
(1, 1, 1, 'Beautiful antique sofa from the 1800s'),
(2, 2, 1, 'Dream beach vacation destination'),
(3, 3, 2, 'T-Rex was the biggest meat-eater ever!'),
(4, 4, 2, 'Awesome pirate ship from the 1700s'),
(5, 5, 3, 'Mountain range at sunrise'),
(6, 6, 3, 'Modern skyscraper in NYC'),
(7, 7, 4, 'Homemade fettuccine alfredo'),
(8, 8, 4, 'Chocolate layer cake with raspberry filling'),
(9, 9, 5, 'Mona Lisa by Leonardo da Vinci'),
(10, 10, 5, 'Abstract steel sculpture');

-- Insert repins (users pinning content from other users)
INSERT INTO Pins (board_id, picture_id, user_id, original_pin_id, description) VALUES
(2, 5, 1, 5, 'Would love to visit these mountains someday'), -- Erica repins John's mountain pic
(3, 4, 2, 4, 'Pirates and dinosaurs together would be awesome!'), -- Timmy repins his own pirate pic to dinosaur board
(5, 2, 3, 2, 'Great location for landscape photography'), -- John repins Erica's beach pic
(7, 8, 4, 8, 'Dessert pasta? Maybe not, but both are delicious!'), -- Sarah repins her own dessert pic to pasta board
(9, 6, 5, 6, 'Architecture as renaissance art'); -- Art lover repins John's architecture pic

-- Insert likes
INSERT INTO Likes (user_id, picture_id) VALUES
(1, 3), -- Erica likes Timmy's dinosaur picture
(1, 5), -- Erica likes John's landscape
(2, 2), -- Timmy likes Erica's beach picture
(3, 1), -- John likes Erica's furniture
(3, 4), -- John likes Timmy's pirate ship
(4, 5), -- Sarah likes John's landscape
(4, 9), -- Sarah likes Art Lover's renaissance art
(5, 2), -- Art Lover likes Erica's beach
(5, 7), -- Art Lover likes Sarah's pasta
(5, 8); -- Art Lover likes Sarah's dessert

-- Insert comments
INSERT INTO Comments (pin_id, user_id, content) VALUES
(1, 3, 'That sofa is gorgeous! Where did you find it?'),
(2, 2, 'I want to go there someday too!'),
(3, 1, 'My son would love this dinosaur!'),
(5, 4, 'Breathtaking view. What camera did you use?'),
(8, 5, 'This cake looks delicious. Would you share the recipe?');

-- Create friendships
INSERT INTO Friendships (user_id_1, user_id_2, status, acceptance_date) VALUES
(1, 2, 'accepted', CURRENT_TIMESTAMP - INTERVAL '10 day'), -- Erica and Timmy are friends
(1, 3, 'accepted', CURRENT_TIMESTAMP - INTERVAL '5 day'),  -- Erica and John are friends
(2, 4, 'pending', NULL), -- Timmy sent request to Sarah, still pending
(3, 5, 'accepted', CURRENT_TIMESTAMP - INTERVAL '2 day'),  -- John and Art Lover are friends
(1, 5, 'accepted', CURRENT_TIMESTAMP - INTERVAL '15 day'); -- Erica and Art Lover are friends

-- Create follow streams
INSERT INTO Follow_Streams (user_id, stream_name) VALUES
(2, 'Monsters and Dinosaurs'), -- Timmy's follow stream
(1, 'Travel Inspiration'),     -- Erica's follow stream
(3, 'Creative Inspiration'),   -- John's follow stream
(4, 'Food Ideas'),             -- Sarah's follow stream
(5, 'Art Collection');         -- Art Lover's follow stream

-- Add boards to follow streams
INSERT INTO Stream_Contents (stream_id, board_id) VALUES
(1, 3), -- Timmy follows his own dinosaur board
(1, 4), -- Timmy follows his own pirate board
(2, 2), -- Erica follows her own vacation board
(2, 5), -- Erica follows John's landscape board
(3, 1), -- John follows Erica's furniture board
(3, 9), -- John follows Art Lover's renaissance art board
(4, 7), -- Sarah follows her own pasta board
(4, 8), -- Sarah follows her own dessert board
(5, 9), -- Art Lover follows their own renaissance art board
(5, 10); -- Art Lover follows their own modern sculpture board







