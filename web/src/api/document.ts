import client, { multipartConfig, toFormData } from './client';
import DocumentPhoto from '../classes/Document';
import { PhotoFile } from '../support/photo';

export function store(owner: 'car'|'client', ownerId: number, type: number, photo: PhotoFile): Promise<DocumentPhoto> {
  return client.post(`${owner}/${ownerId}/document`, toFormData({ type, photo }), multipartConfig).then(response => response.data.data);
}

export const destroy = (id: number) => client.delete('document/' + id);
