import axios from 'axios';

axios.defaults.baseURL = 'https://pixabay.com/api/';
const API_KEY = '51662095-362d68f1fb432ef34c7441ea2';

export const PER_PAGE = 15;


export async function getImagesByQuery(query, page = 1) {
    
    const { data } = await axios.get('', {
        params: {
            key: API_KEY,
            per_page: PER_PAGE,
            page: page,
            q: query,
            image_type: 'photo',
            orientation: 'horizontal',
            safesearch: true,
        },
    });
    return data;
}
