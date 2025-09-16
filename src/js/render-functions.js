import SimpleLightbox from 'simplelightbox';
import 'simplelightbox/dist/simple-lightbox.min.css';

let lightbox;

const gallery  = document.getElementById('gallery');
const loaderEl = document.getElementById('loader');
const moreBtn  = document.getElementById('moreBtn');


export function createGallery(images = []) {


  const markup = images
    .map(
      ({ webformatURL, largeImageURL, tags, likes, views, comments, downloads }) => `
      <li class="photo-card">
        <a class="gallery__item" href="${largeImageURL}">
          <img class="gallery__image" src="${webformatURL}" alt="${tags}" loading="lazy" />
        </a>
        <ul class="info">
          <li><b>Likes:</b> ${likes}</li>
          <li><b>Views:</b> ${views}</li>
          <li><b>Comments:</b> ${comments}</li>
          <li><b>Downloads:</b> ${downloads}</li>
        </ul>
      </li>`
    )
    .join('');

  gallery.insertAdjacentHTML('beforeend', markup);

  if (!lightbox) {
    lightbox = new SimpleLightbox('#gallery a', {
      captionsData: 'alt',
      captionDelay: 250,
    });
  } else {
    lightbox.refresh();
  }
}


export function clearGallery() {
  const gallery = document.querySelector('#gallery');
  if (gallery) gallery.innerHTML = '';
}


export function showLoader() {

  loaderEl.classList.remove('is-hidden');
}

export function hideLoader() {
  if (loaderEl) {
    loaderEl.classList.add('is-hidden');
  }
}

export function showLoadMoreButton() {
    moreBtn.classList.remove('is-hidden');
}

export function hideLoadMoreButton() {
    moreBtn.classList.add('is-hidden');
}

