import { Component } from '@angular/core';
import { Novel } from '../../components/novel-card/novel-card.component';

@Component({
  selector: 'app-rankings',
  templateUrl: './rankings.component.html',
  styleUrls: ['./rankings.component.css']
})
export class RankingsComponent {
  rankedNovels: Novel[] = [
    { title: 'The King\'s Avatar', genre: 'Gaming', rating: 4.9 },
    { title: 'Solo Leveling', genre: 'Fantasy', rating: 4.8 },
    { title: 'Omniscient Reader', genre: 'Fantasy', rating: 4.7 },
    { title: 'Release That Witch', genre: 'Fantasy', rating: 4.6 },
    { title: 'Warlock of the Magus World', genre: 'Fantasy', rating: 4.5 },
    { title: 'Lord of the Mysteries', genre: 'Mystery', rating: 4.9 },
    { title: 'The Immortal Swordsman', genre: 'Fantasy', rating: 4.5 },
    { title: 'Academy of Magic', genre: 'Fantasy', rating: 4.7 },
    { title: 'Cybernetic Rebirth', genre: 'Sci-Fi', rating: 4.2 },
    { title: 'Dragon Emperor', genre: 'Fantasy', rating: 4.8 }
  ];
}
