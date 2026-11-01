/** Fotos que mostrará el visor; evita pasar rutas largas por los parámetros de la ruta. */
let photos: string[] = [];

export const setViewerPhotos = (uris: string[]) => {
  photos = uris;
};

export const getViewerPhotos = () => photos;
