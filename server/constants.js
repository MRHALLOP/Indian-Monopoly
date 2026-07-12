const CITIES = [
  { id: 0, name: "GO", type: "special", color: "bg-white text-black" },
  { id: 1, name: "Guwahati", price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50, color: "bg-amber-900" },
  { id: 2, name: "Community Chest", type: "special", color: "bg-cyan-600" },
  { id: 3, name: "Bhubaneswar", price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, color: "bg-amber-900" },
  { id: 4, name: "Income Tax", type: "tax", cost: 200, color: "bg-gray-500" },
  { id: 5, name: "Chennai Central", price: 200, type: "station", rent: [25], color: "bg-gray-800" },
  { id: 6, name: "Panaji", price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, color: "bg-sky-400" },
  { id: 7, name: "Chance", type: "special", color: "bg-orange-500" },
  { id: 8, name: "Agra", price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, color: "bg-sky-400" },
  { id: 9, name: "Vadodara", price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, color: "bg-sky-400" },
  { id: 10, name: "Jail", type: "special", color: "bg-orange-600" },
  { id: 11, name: "Ludhiana", price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, color: "bg-pink-500" },
  { id: 12, name: "Electric Company", price: 150, type: "utility", color: "bg-yellow-400" },
  { id: 13, name: "Patna", price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, color: "bg-pink-500" },
  { id: 14, name: "Bhopal", price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, color: "bg-pink-500" },
  { id: 15, name: "Howrah Station", price: 200, type: "station", rent: [25], color: "bg-gray-800" },
  { id: 16, name: "Indore", price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, color: "bg-orange-400" },
  { id: 17, name: "Community Chest", type: "special", color: "bg-cyan-600" },
  { id: 18, name: "Nagpur", price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, color: "bg-orange-400" },
  { id: 19, name: "Kochi", price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, color: "bg-orange-400" },
  { id: 20, name: "Free Parking", type: "special", color: "bg-red-500 text-white" },
  { id: 21, name: "Lucknow", price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, color: "bg-red-600" },
  { id: 22, name: "Chance", type: "special", color: "bg-orange-500" },
  { id: 23, name: "Chandigarh", price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, color: "bg-red-600" },
  { id: 24, name: "Jaipur", price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, color: "bg-red-600" },
  { id: 25, name: "New Delhi Stn", price: 200, type: "station", rent: [25], color: "bg-gray-800" },
  { id: 26, name: "Pune", price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, color: "bg-yellow-500" },
  { id: 27, name: "Water Works", price: 150, type: "utility", color: "bg-blue-400" },
  { id: 28, name: "Hyderabad", price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, color: "bg-yellow-500" },
  { id: 29, name: "Ahmedabad", price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, color: "bg-yellow-500" },
  { id: 30, name: "Go to Jail", type: "special", color: "bg-blue-900 text-white" },
  { id: 31, name: "Kolkata", price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, color: "bg-green-600" },
  { id: 32, name: "Chennai", price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, color: "bg-green-600" },
  { id: 33, name: "Community Chest", type: "special", color: "bg-cyan-600" },
  { id: 34, name: "Bengaluru", price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, color: "bg-green-600" },
  { id: 35, name: "CST Mumbai", price: 200, type: "station", rent: [25], color: "bg-gray-800" },
  { id: 36, name: "Chance", type: "special", color: "bg-orange-500" },
  { id: 37, name: "Delhi", price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, color: "bg-blue-800" },
  { id: 38, name: "Luxury Tax", type: "tax", cost: 100, color: "bg-gray-500" },
  { id: 39, name: "Mumbai", price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, color: "bg-blue-800" }
];
// Color groups: maps a color class to all property IDs in that group.
// Only includes buildable property colors (excludes stations, utilities, specials, taxes).
const COLOR_GROUPS = {};
CITIES.forEach(city => {
  if (city.color && !city.type && city.price) {
    if (!COLOR_GROUPS[city.color]) COLOR_GROUPS[city.color] = [];
    COLOR_GROUPS[city.color].push(city.id);
  }
});

module.exports = { CITIES, COLOR_GROUPS };