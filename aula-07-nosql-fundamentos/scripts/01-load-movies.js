// Carrega ~30 documentos de filmes para demos CRUD
// Uso: docker exec -i aula07-mongo mongosh < scripts/01-load-movies.js

const db = db.getSiblingDB("cinema");

db.movies.drop();

print("=== Inserindo dataset de filmes ===");
const inserted = db.movies.insertMany([
  { title: "Inception",        category: ["action", "sci-fi"],     imdbRating: 8.8, budget: 160, year: 2010, director: { name: "Christopher Nolan", country: "UK" }, awards: ["Oscar VFX"] },
  { title: "Interstellar",     category: ["sci-fi", "drama"],      imdbRating: 8.6, budget: 165, year: 2014, director: { name: "Christopher Nolan", country: "UK" } },
  { title: "Tenet",            category: ["action", "sci-fi"],     imdbRating: 7.4, budget: 200, year: 2020, director: { name: "Christopher Nolan", country: "UK" } },
  { title: "Dunkirk",          category: ["war", "drama"],         imdbRating: 7.8, budget: 100, year: 2017, director: { name: "Christopher Nolan", country: "UK" } },
  { title: "The Dark Knight",  category: ["action", "drama"],      imdbRating: 9.0, budget: 185, year: 2008, director: { name: "Christopher Nolan", country: "UK" }, awards: ["Oscar", "BAFTA"] },
  { title: "Oppenheimer",      category: ["drama", "biography"],   imdbRating: 8.5, budget: 100, year: 2023, director: { name: "Christopher Nolan", country: "UK" }, awards: ["Oscar Best Picture"] },
  { title: "Parasite",         category: ["drama", "thriller"],    imdbRating: 8.6, budget: 11,  year: 2019, director: { name: "Bong Joon-ho", country: "South Korea" }, awards: ["Oscar Best Picture", "Palme d'Or"] },
  { title: "The Matrix",       category: ["sci-fi", "action"],     imdbRating: 8.7, budget: 63,  year: 1999, director: { name: "Wachowski Sisters", country: "USA" } },
  { title: "Pulp Fiction",     category: ["crime", "drama"],       imdbRating: 8.9, budget: 8,   year: 1994, director: { name: "Quentin Tarantino", country: "USA" }, awards: ["Palme d'Or"] },
  { title: "Goodfellas",       category: ["crime", "drama"],       imdbRating: 8.7, budget: 25,  year: 1990, director: { name: "Martin Scorsese", country: "USA" } },
  { title: "The Godfather",    category: ["crime", "drama"],       imdbRating: 9.2, budget: 6,   year: 1972, director: { name: "Francis Ford Coppola", country: "USA" }, awards: ["Oscar Best Picture"] },
  { title: "Cidade de Deus",   category: ["crime", "drama"],       imdbRating: 8.6, budget: 3.3, year: 2002, director: { name: "Fernando Meirelles", country: "Brazil" } },
  { title: "Central do Brasil",category: ["drama"],                imdbRating: 8.0, budget: 2.9, year: 1998, director: { name: "Walter Salles", country: "Brazil" }, awards: ["Golden Bear"] },
  { title: "Tropa de Elite",   category: ["action", "crime"],      imdbRating: 8.0, budget: 4,   year: 2007, director: { name: "José Padilha", country: "Brazil" } },
  { title: "Spirited Away",    category: ["animation", "fantasy"], imdbRating: 8.6, budget: 19,  year: 2001, director: { name: "Hayao Miyazaki", country: "Japan" }, awards: ["Oscar Animated"] },
  { title: "Your Name",        category: ["animation", "romance"], imdbRating: 8.4, budget: 11,  year: 2016, director: { name: "Makoto Shinkai", country: "Japan" } },
  { title: "Spider-Verse",     category: ["animation", "action"],  imdbRating: 8.4, budget: 90,  year: 2018, director: { name: "Persichetti, Ramsey, Rothman", country: "USA" }, awards: ["Oscar Animated"] },
  { title: "Coco",             category: ["animation", "family"],  imdbRating: 8.4, budget: 175, year: 2017, director: { name: "Lee Unkrich", country: "USA" }, awards: ["Oscar Animated"] },
  { title: "Dune",             category: ["sci-fi", "adventure"],  imdbRating: 8.0, budget: 165, year: 2021, director: { name: "Denis Villeneuve", country: "Canada" } },
  { title: "Dune Part Two",    category: ["sci-fi", "adventure"],  imdbRating: 8.5, budget: 190, year: 2024, director: { name: "Denis Villeneuve", country: "Canada" } },
  { title: "Arrival",          category: ["sci-fi", "drama"],      imdbRating: 7.9, budget: 47,  year: 2016, director: { name: "Denis Villeneuve", country: "Canada" } },
  { title: "Blade Runner 2049",category: ["sci-fi"],               imdbRating: 8.0, budget: 150, year: 2017, director: { name: "Denis Villeneuve", country: "Canada" } },
  { title: "Whiplash",         category: ["drama", "music"],       imdbRating: 8.5, budget: 3.3, year: 2014, director: { name: "Damien Chazelle", country: "USA" } },
  { title: "La La Land",       category: ["romance", "music"],     imdbRating: 8.0, budget: 30,  year: 2016, director: { name: "Damien Chazelle", country: "USA" } },
  { title: "Mad Max: Fury Road",category:["action", "adventure"],  imdbRating: 8.1, budget: 150, year: 2015, director: { name: "George Miller", country: "Australia" } },
  { title: "Everything Everywhere",category:["sci-fi", "comedy"],  imdbRating: 7.8, budget: 25,  year: 2022, director: { name: "Daniels", country: "USA" }, awards: ["Oscar Best Picture"] },
  { title: "The Substance",    category: ["horror", "drama"],      imdbRating: 7.6, budget: 17.5,year: 2024, director: { name: "Coralie Fargeat", country: "France" } },
  { title: "Anatomy of a Fall",category: ["drama", "thriller"],    imdbRating: 7.7, budget: 6,   year: 2023, director: { name: "Justine Triet", country: "France" }, awards: ["Palme d'Or"] },
  { title: "Drive",            category: ["crime", "drama"],       imdbRating: 7.8, budget: 15,  year: 2011, director: { name: "Nicolas Refn", country: "Denmark" } },
  { title: "There Will Be Blood",category:["drama"],               imdbRating: 8.2, budget: 25,  year: 2007, director: { name: "Paul Thomas Anderson", country: "USA" } }
]);

print(`Inseridos: ${Object.keys(inserted.insertedIds).length} documentos`);
print(`Total na coleção: ${db.movies.countDocuments()}`);
