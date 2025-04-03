import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.binsearch.info/*'],

  main(ctx) {
    new BinsearchContent(ctx);
  },
});

class BinsearchContent extends Content {
  get id() {
    return 'binsearch';
  }

  get useLightTheme() {
    return true;
  }

  get isDetail(): boolean {
    return (
      window.location.pathname.startsWith('/details') ||
      /(\?|&)(b)=/.test(window.location.search)
    );
  }

  get isList(): boolean {
    return /(\?|&)(q|bg|watchlist)=/.test(window.location.search);
  }

  form: HTMLFormElement | null = null;

  async ready() {
    this.form = document.querySelector('form[action="/nzb"]');
    if (!this.form) {
      console.warn(`[NZB Unity] Could not locate form, 1-click disabled`);
      return false; // disable
    }
  }

  initializeDetailLinks = () => {
    const button = this.createButton();
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const data = new FormData(this.form!);
      const params: Record<string, string> = {};
      for (const [key, value] of data.entries()) {
        params[key] = `${value}`;
      }
      const filename = params.name;

      button.dispatchEvent(new Event('nzb.pending'));

      try {
        const result = await this.addFileByRequest(
          filename,
          '',
          this.form!.action,
          params,
          this.form!.method || 'POST',
        );

        this.ctx.setTimeout(() => {
          button.dispatchEvent(
            new Event(result?.success ? 'nzb.success' : 'nzb.failure'),
          );
        }, 1000);
      } catch (err) {
        console.error(`[NZB Unity] Error fetching NZB content (${filename})`, err);
      }
    });

    this.form!.querySelector('& > div.flex')?.prepend(button);
  };

  initializeListLinks = () => {
    for (const el of this.form!.querySelectorAll('input[type="checkbox"][name]')) {
      const checkbox = el as HTMLInputElement;
      const link = this.createLink({
        styles: { margin: '0 0 3px 3px' },
      });

      link.addEventListener('click', async (e) => {
        e.preventDefault();

        link.dispatchEvent(new Event('nzb.pending'));

        const nzbId = checkbox.getAttribute('name') as string;

        const data = new FormData(this.form!);
        const params: Record<string, string> = {};
        for (const [key, value] of data.entries()) {
          if ((value as string) !== 'on')
            // skip checkboxes
            params[key] = `${value}`;
        }

        console.info(`[NZB Unity] Adding NZB ${nzbId}`);

        try {
          const result = await this.addFileByRequest(
            nzbId,
            '',
            this.form!.action,
            {
              ...params,
              [nzbId]: 'on',
            },
            this.form!.method || 'POST',
          );

          this.ctx.setTimeout(() => {
            link.dispatchEvent(
              new Event(result?.success ? 'nzb.success' : 'nzb.failure'),
            );
          }, 1000);
        } catch (err) {
          console.error(`[NZB Unity] Error fetching NZB content (${nzbId})`, err);
        }
      });

      checkbox.insertAdjacentElement('afterend', link);
    }

    const button = this.createButton();
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const checkboxes = this.form!.querySelectorAll(
        'input[type="checkbox"][name]:checked',
      );
      const nzbIds = Array.from(checkboxes)
        .map((el) => (el as HTMLInputElement).getAttribute('name'))
        .filter((el) => el !== null) as string[];

      if (nzbIds.length) {
        console.info(`[NZB Unity] Adding ${nzbIds.length} NZB(s)`);
        button.dispatchEvent(new Event('nzb.pending'));

        const data = new FormData(this.form!);
        const params: Record<string, string> = {};
        for (const [key, value] of data.entries()) {
          if ((value as string) !== 'on')
            // skip checkboxes
            params[key] = `${value}`;
        }

        const results = await Promise.all(
          nzbIds.map((nzbId) => {
            try {
              return this.addFileByRequest(
                nzbId,
                '',
                this.form!.action,
                {
                  ...params,
                  [nzbId!]: 'on',
                },
                this.form!.method || 'POST',
              );
            } catch (err) {
              console.error(`[NZB Unity] Error fetching NZB content (${nzbId})`, err);
              return false;
            }
          }),
        );

        this.ctx.setTimeout(() => {
          if (results.every((r) => r)) {
            button.dispatchEvent(new Event('nzb.success'));
          } else {
            button.dispatchEvent(new Event('nzb.failure'));
          }
        }, 1000);
      }
    });

    this.form!.querySelector('& > div.flex')?.prepend(button);
  };
}
