/* global chrome, $, Initialize, addToSABnzbd, logger */

function getNzbId (elem) {
  var match = /\?id=([0-9a-zA-Z]{5})/i.exec(elem);

  if (typeof match !== 'undefined' && match != null) {
    var nzbId = match[1];
    return nzbId;
  } else {
    return null;
  }
}

function getUserName () {
  return $("a[href='/account']").html();
}

function getApiKey () {
  var protocol = 'http';

  if (window.location.href.indexOf('https') === 0) {
    protocol = 'https';
  }

  var apiHtml = $.ajax({url: protocol + '://omgwtfnzbs.me/account.php?action=api', async: false}).responseText;
  var apiKey = $(apiHtml).find('font[color="Orange"]').html();

  if (apiKey != null) {
    return apiKey;
  } else {
    return null;
  }
}

function addToSABnzbdFromOmgwtfnzbs (e) {
  e.preventDefault();

  // Set the image to an in-progress image
  var img = chrome.extension.getURL('images/sab2_16_fetching.png');
  $(this).find('img').attr('src', img);

  var nzburl = $(this).attr('href');
  var addLink = this;
  var url = 'http://api.omgwtfnzbs.me/nzb/?';

  if (nzburl.indexOf('https://') === 0) {
    url = 'https://api.omgwtfnzbs.me/nzb/?';
  }

  // Build up the URL to the API for direct downloading by getting the NZB Id, Username and API Key
  url = url + 'id=' + getNzbId(nzburl) + '&user=' + getUserName() + '&api=' + getApiKey();

  // Get the category
  var category = null;
  var catSrc = 'default';

  if ($('#category').length) {
    // Short circuit if there is a category element (usually the details page)
    category = $('#category').text();
    catSrc = '#';
  } else if (window.location.pathname.match(/^\/trends/)) {
    // Trends page
    category = $(this).closest('li,tr').find('.bmtip.cat_class').text();
    catSrc = 'trends';
  } else {
    // Everything else (usually the browse page)
    category = $(this).closest('li,tr').find('.linky[href^="browse?cat="]').text();
    catSrc = 'href';
  }

  category = category.match(/^\s*([^:\s]+)/); // Either "Movies: HD" or "Movies HD"
  category = $.trim(category && category[1] || null);

  if (category === null) {
    category = 'default';
  }

  logger('Adding to NZB from omgwtfnzbs: ' + [nzburl, category, catSrc].join(', '));

  // Send the NZB to SABnzbd
  addToSABnzbd(
    addLink,
    url,
    'addurl',
    null,
    category
  );

  return false;
}

function handleAllDownloadLinks () {
  $('img[src="pics/dload.gif"]').each(function () {
    var href = $(this).parent().attr('href');
    var img = chrome.extension.getURL('/images/sab2_16.png');
    var linkMini = '<a class="addSABnzbd" href="' + href + '" style="vertical-align: middle;"><img border="0" src="' + img + '" title="Send to SABnzbd" style="position:relative;margin-top:5px;width:16px;" /></a>&nbsp;';
    var linkFull = '<a class="addSABnzbd linky" href="' + href + '"><img border="0" src="' + img + '" title="Send to SABnzbd" /> Send to SABnzbd</a>&nbsp;';

    if ($(this).parent().hasClass('linky') === false) {
      $(this).parent().before(linkMini);
    } else {
      $(this).parent().before(linkFull);
    }
  });

  // Change the on click handler to send to sabnzbd
  // moved because the way it was the click was firing multiple times
  $('.addSABnzbd').each(function () {
    $(this).click(addToSABnzbdFromOmgwtfnzbs);
  });
}

Initialize('omgwtfnzbs', null, function () {
  handleAllDownloadLinks();
});
