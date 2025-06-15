/* main.js — point d’entrée */
import { loadData } from './loader.js';
import { buildUI } from './ui.js';

loadData().then(({ gov, del, sec }) => {
  buildUI(gov, del, sec);
}).catch(err => {
  console.error('Erreur lors du chargement des données :', err);
});
