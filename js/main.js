
/* main.js — point d’entrée avec loader visuel */
import { loadData } from './loader.js';
import { buildUI } from './ui.js';

function showLoader(txt='Chargement…'){
  const l=document.getElementById('loader');
  l.querySelector('.loading-text').textContent=txt;
  l.classList.remove('hidden');
}
function hideLoader(){ document.getElementById('loader').classList.add('hidden'); }

window.showLoader = showLoader;
window.hideLoader = hideLoader;

showLoader('Chargement des données…');
loadData().then(({ gov, del, sec }) => {
  buildUI(gov, del, sec);
}).catch(err=>{
  console.error('Erreur lors du chargement :',err);
  alert('Erreur de chargement des données');
}).finally(hideLoader);
