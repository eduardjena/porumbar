let loading: Promise<void> | null = null;

/**
 * Aduce lista feliilor fontului japonez (japoneza.css), o singură dată; literele vin apoi doar câte trebuie. Dacă nu
 * vine, se scrie cu fontul sistemului și se încearcă iar data viitoare.
 */
export function loadJapaneseFont(): Promise<void> {
  return (loading ??= new Promise<void>((done) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/japoneza.css';
    link.onload = () => done();
    link.onerror = () => {
      loading = null;
      link.remove();
      done();
    };
    document.head.appendChild(link);
  }));
}
