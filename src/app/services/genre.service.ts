import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Genre {
  id: number;
  name: string;
}

export interface CreateGenreDto {
  name: string;
}

export interface UpdateGenreDto {
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class GenreService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getAllGenres(): Observable<Genre[]> {
    return this.http.get<Genre[]>(`${this.apiUrl}/api/Genre/get-all-genre`);
  }

  createGenre(genre: CreateGenreDto): Observable<Genre> {
    return this.http.post<Genre>(`${this.apiUrl}/api/Genre/create-genre`, genre);
  }

  updateGenre(id: number, genre: UpdateGenreDto): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/api/Genre/update-genre/${id}`, genre);
  }

  deleteGenre(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/api/Genre/delete-genre/${id}`);
  }
}
