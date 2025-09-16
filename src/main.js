import iziToast from 'izitoast';
import 'izitoast/dist/css/iziToast.min.css';
import { getImagesByQuery, PER_PAGE } from './js/pixabay-api.js';
import {
  createGallery,
  clearGallery,
  showLoader,
  hideLoader,
  hideLoadMoreButton,
  showLoadMoreButton,
} from './js/render-functions.js';

const form = document.querySelector('form');
const submitBtn = form.querySelector('button[type="submit"]');
const moreBtn = document.querySelector('#moreBtn');

let query = '';
let currentPage = 1;


form.addEventListener('submit', async (e) => {
  e.preventDefault();

  query = new FormData(e.target).get('searchText').trim();
  currentPage = 1;                
  hideLoadMoreButton();          

  if (!query) {
    iziToast.error({
      position: 'center',
      title: 'Помилка',
      message: 'Ви нічого не ввели!',
    });
    return;
  }

  const oldText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Searching…';

  clearGallery();
  showLoader();

  try {
    const  data  = await getImagesByQuery(query, currentPage);
    const { hits, total } = data;

    console.log(`totalHits: ${total}`);

    if (hits.length === 0) {
      iziToast.warning({
        position: 'center',
        title: 'Немає результатів',
        message: 'Нічого не знайдено.',
      });
      hideLoadMoreButton();
      return;
    }

    createGallery(hits);


    if (currentPage * PER_PAGE < total) {
      showLoadMoreButton();
    } else {
      hideLoadMoreButton();
      iziToast.info({
    position: 'bottomCenter',
    title: 'Кінець',
    message: "Більше немає результатів.",
  });
    }
  } catch (err) {
    console.log(err);
    iziToast.error({
      position: 'center',
      title: err?.message || 'Помилка запиту',
      message: 'Спробуйте ще раз пізніше.',
    });
  } finally {
    hideLoader();
    submitBtn.disabled = false;
    submitBtn.textContent = oldText;
    e.target.reset();
  }
});

moreBtn.addEventListener('click', async () => {
  moreBtn.disabled = true;
  currentPage += 1;

  showLoader();
  try {
    const data  = await getImagesByQuery(query, currentPage);
    createGallery(data.hits);
 

    const { height: cardHeight } = document
    .querySelector('.gallery')
     .firstElementChild.getBoundingClientRect();

    window.scrollBy({
     top: cardHeight * 2,
     behavior: 'smooth',
     });


    if (currentPage * PER_PAGE >= data.total) {
      hideLoadMoreButton();
      iziToast.info({
    position: 'bottomCenter',
    title: 'Кінець',
    message: "Це всі результати за запитом.",
  });
    }
  } catch (err) {
    console.log(err);
  } finally {
    hideLoader();
    moreBtn.disabled = false;
  }
});
