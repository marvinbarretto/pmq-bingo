import { Component, input, computed } from '@angular/core';

interface GifData {
  url: string;
  alt: string;
}

// Celebratory political GIFs for wins
const POSITIVE_GIFS: GifData[] = [
  {
    url: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnNoaG9kdmc1OTFsZ2RwMWljMjNtb3pvbDl1bDdieHU1MXk1NTE5eiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/W6LseEDi5oXHci8UBn/giphy.gif',
    alt: 'Parliament celebration',
  },
  {
    url: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNmJ4bGV6a3dmZWR5dWtwZXdrcnJxdzY2aWd5dGJncnZhN2xkNGFhbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XBG9HUZKxoi5ejafg7/giphy.gif',
    alt: 'PMQs cheering',
  },
  {
    url: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbDl6bHh1bzcybnNmbXc2MDJ0ZjM0aHQzOTd0ZjB2eDdkZnhtMngzbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/tOVe8bLBJVFba/giphy.gif',
    alt: 'Political victory',
  },
  {
    url: 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnlkZG93amlzaDN0NDQ1M2NxeGUxYTdmYjhta2htNGl5OTkzejlkNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/QUARSwShNl0uTaAlIJ/giphy.gif',
    alt: 'House of Commons applause',
  },
];

// Negative GIFs (for future use)
const NEGATIVE_GIFS: GifData[] = [
  {
    url: 'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2ZkdG5ncDhkYTg5M2puc2U5a2w3ZWlzam5zZjB0MWlpYWdtYmd1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BzhQ1O2kdpGw35Q1a9/giphy.gif',
    alt: 'Parliament disappointment',
  },
  {
    url: 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZDIzbGRnYXRpNjlka3FuY2VsN2l6cG1seWthMmp1ajM5Z2Examh1ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KbedjkA6nELGG1brZA/giphy.gif',
    alt: 'PMQs frustration',
  },
  {
    url: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGlxZDdhZzBreXdnYXMzamI2M2M5MnNxc3p3ZXBrancxMW11M21jMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/U4SmKRsONdPnYvsjSE/giphy.gif',
    alt: 'Political defeat',
  },
];

@Component({
  selector: 'app-celebration-gif',
  templateUrl: './celebration-gif.html',
  styleUrl: './celebration-gif.scss',
})
export class CelebrationGif {
  readonly type = input<'positive' | 'negative'>('positive');

  readonly gif = computed(() => {
    const gifs = this.type() === 'positive' ? POSITIVE_GIFS : NEGATIVE_GIFS;
    const randomIndex = Math.floor(Math.random() * gifs.length);
    return gifs[randomIndex];
  });
}
