export interface CyclingQuote {
  text: string;
  author: string;
}

export const cyclingQuotes: CyclingQuote[] = [
  { text: "Le vélo ne ment jamais.", author: "Greg LeMond" },
  { text: "La course, c'est la vie condensée.", author: "Eddy Merckx" },
  { text: "Il faut souffrir pour être beau… au classement.", author: "Bernard Hinault" },
  { text: "Tant que je respire, j'attaque.", author: "Bernard Hinault" },
  { text: "On ne gagne pas le Tour de France au repos.", author: "Jacques Anquetil" },
  { text: "Le cyclisme est un sport de souffrance.", author: "Fausto Coppi" },
  { text: "La montagne ne triche pas.", author: "Lucien Van Impe" },
  { text: "Le vélo, c'est de l'art en mouvement.", author: "Laurent Fignon" },
  { text: "Rouler, c'est méditer avec les jambes.", author: "Anonyme" },
  { text: "La douleur est temporaire, l'abandon est définitif.", author: "Anonyme" },
  { text: "Chaque coup de pédale est une promesse.", author: "Anonyme" },
  { text: "La route ne se soucie pas de ta fatigue.", author: "Anonyme" },
  { text: "Un bon grimpeur souffre autant que les autres, il va juste plus vite.", author: "Marco Pantani" },
  { text: "Le peloton pardonne rarement.", author: "Sean Kelly" },
  { text: "Il n'y a pas de raccourcis vers le sommet.", author: "Anonyme" },
  { text: "Le maillot jaune se mérite chaque jour.", author: "Anonyme" },
];

export function getRandomQuote(): CyclingQuote {
  return cyclingQuotes[Math.floor(Math.random() * cyclingQuotes.length)];
}
