class PageUtil {
    static readonly iconGreen:string = chrome.extension.getURL('content/images/nzb-16-green.png');
    static readonly iconGrey:string = chrome.extension.getURL('content/images/nzb-16-grey.png');
    static readonly iconOrange:string = chrome.extension.getURL('content/images/nzb-16-orange.png');
    static readonly iconRed:string = chrome.extension.getURL('content/images/nzb-16-reg.png');
    static readonly backgroundNormal:string = 'rgb(23, 162, 184)';
    static readonly backgroundPending:string = 'rgb(156, 166, 168)';

    static request(options:RequestOptions):Promise<any> {
      options.url = `${window.location.origin}${options.url || ''}`;
      return Util.request(options);
    }

    static requestAndAddFile(
      filename:string,
      category:string = '',
      url:string = window.location.origin,
      params:StringDictionary = {},
    ):Promise<any> {
      // A lot of sites require POST to fetch NZB and follow this pattern (binsearch, nzbindex, nzbking)
      // Fetches a single NZB from a POST request and adds it to the server as a file upload
      return Util.request({ method: 'POST', url, params })
        .then(content => Util.sendMessage({
          'content.addFile': { filename, content, category }
        }));
    }

    static bindAddUrl(
      options:CreateAddLinkOptions,
      el:JQuery<HTMLElement>|HTMLElement,
      exclusive:boolean = false,
    ):JQuery<HTMLElement> {
      if (exclusive) {
        $(el).off('click');
      }

      return $(el)
        .on('click', (e) => {
          e.preventDefault();
          console.info(`[NZB Unity] Adding URL: ${options.url}`);

          $(e.target).trigger('nzb.pending');

          Util.sendMessage({ 'content.addUrl': options })
            .then((r:boolean) => {
              setTimeout(() => {
                $(e.target).trigger(r === false ? 'nzb.failure' : 'nzb.success');
              }, 1000);
            });
        }) as JQuery<HTMLElement>;
    }

    static createLink():JQuery<HTMLElement> {
      return $(`
        <a class="NZBUnityLink" title="Download with NZB Unity">
          <img src="${PageUtil.iconGreen}">
        </a>
      `)
        .css({
          cursor: 'pointer',
          display: 'inline-block',
        })
        .on('nzb.pending', (e) => {
          $(e.currentTarget).find('img').attr('src', PageUtil.iconGrey)
        })
        .on('nzb.success', (e) => {
          $(e.currentTarget).find('img').attr('src', PageUtil.iconGreen)
        })
        .on('nzb.failure', (e) => {
          $(e.currentTarget).find('img').attr('src', PageUtil.iconRed)
        });
    }

    static createButton():JQuery<HTMLElement> {
      return $(`
        <button class="NZBUnityDownloadAll"
          title="Download selected items with NZB Unity"
        >
          Download Selected
        </button>
      `)
        .css({
          background: `${PageUtil.backgroundNormal} url(${PageUtil.iconGreen}) no-repeat scroll 4px center`,
          border: '1px solid rgb(19, 132, 150)',
          'border-radius': '4px',
          color: '#fff',
          cursor: 'pointer',
          display: 'inline-block',
          'font-size': '11px',
          'font-weight': 'normal',
          margin: '0 0.5em 0 0',
          padding: '3px 8px 3px 25px',
          'text-shadow': '0 -1px 0 rgba(0,0,0,0.25)',
          'white-space': 'nowrap',
        })
        .on('nzb.pending', (e) => {
          $(e.currentTarget).css({
            'background-color': PageUtil.backgroundPending,
            'background-image': `url(${PageUtil.iconGrey})`,
          });
        })
        .on('nzb.success', (e) => {
          $(e.currentTarget).css({
            'background-color': PageUtil.backgroundNormal,
            'background-image': `url(${PageUtil.iconGreen})`,
          });
        })
        .on('nzb.failure', (e) => {
          $(e.currentTarget).css({
            'background-color': PageUtil.backgroundNormal,
            'background-image': `url(${PageUtil.iconRed})`,
          });
        });
    }

    static createAddUrlLink(options:CreateAddLinkOptions, adjacent:JQuery<HTMLElement>|HTMLElement = null):JQuery<HTMLElement> {
      // console.log('createAddUrlLink', url, category);
      const link = PageUtil.bindAddUrl(options, PageUtil.createLink())
        .attr('href', options.url)
        .css({
          height: '16px',
          width: '16px',
        });

      if (adjacent) {
        link.insertAfter(adjacent);
      }

      return link;
    }

    static createAddUrlButton(options:CreateAddLinkOptions, adjacent:JQuery<HTMLElement>|HTMLElement = null):JQuery<HTMLElement> {
      // console.log('createAddUrlLink', url, category);
      const button = PageUtil.bindAddUrl(options, PageUtil.createButton());

      if (adjacent) {
        button.insertAfter(adjacent);
      }

      return button;
    }
  }