import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  currentYear: number = new Date().getFullYear();
  companyName: string = 'WebNovel';
  
  socialLinks = [
    { name: 'Facebook', icon: 'facebook', url: 'https://facebook.com/' },
    { name: 'Twitter', icon: 'twitter', url: 'https://twitter.com/' },
    { name: 'Instagram', icon: 'instagram', url: 'https://instagram.com/' },
    { name: 'Discord', icon: 'discord', url: 'https://discord.gg/' }
  ];
} 