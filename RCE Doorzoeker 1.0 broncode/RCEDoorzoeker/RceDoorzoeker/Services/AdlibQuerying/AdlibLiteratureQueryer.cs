using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Web;
using System.Xml.XPath;
using RceDoorzoeker.Services.RnaApiClient.DTO;
using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Services.AdlibQuerying
{
	public class AdlibLiteratureQueryer
	{
		private readonly string _apiBaseUrl;

		public AdlibLiteratureQueryer(string apiBaseUrl)
		{
			_apiBaseUrl = apiBaseUrl;
		}

		public PagedList<ItemLiterature> ListLiterature(Item item, int start = 0, int count = 10)
		{
			//?database=books&search=pointer%201964%20and%20tr-%3ERN='{0}'
			var query = string.Format("?database=books&search=pointer%201964%20and%20tr-%3ERN='{0}'&startfrom={1}&limit={2}", item.Uri, start, count);

			var client = new HttpClient();
			client.BaseAddress = new Uri(_apiBaseUrl);
			client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("text/xml"));

			// Note: Could be really specific about the fields we ask

			// Note: can page around startfrom field
			HttpResponseMessage response = client.GetAsync(query).Result;

			if (!response.IsSuccessStatusCode)
			{
				throw new HttpException((int)HttpStatusCode.BadRequest,
					string.Format("Error retrieving images for item {0} error: {1}", item.Uri, response.ReasonPhrase));
			}

			var xPathDocument = new XPathDocument(response.Content.ReadAsStreamAsync().Result);

			var literature = ParseLiterature(xPathDocument);

			return new PagedList<ItemLiterature>()
				{
					Items = literature.ToList(),
					TotalCount = ParseTotalCount(xPathDocument)
				};
		}

		
		private int ParseTotalCount(XPathDocument xPathDocument)
		{
			var node = xPathDocument.CreateNavigator().SelectSingleNode("//diagnostic/hits/text()");

			return node.ValueAsInt;
		}

		private IEnumerable<ItemLiterature> ParseLiterature(XPathDocument xPathDocument)
		{
			var records = xPathDocument.CreateNavigator().Select("//record");

			foreach (XPathNavigator record in records)
			{
				var priref = record.SelectSingleNode("priref/text()").Value;
				
				var title = record.SelectSingleNode("title/value/text()").Value;
				
				// Note: could have more then one author
				var authorNode = record.SelectSingleNode("Author/author.name/value/text()");

				string author = null;
				if (authorNode != null)
				{
					author = authorNode.Value;
				}

				var publicationNode = record.SelectSingleNode("Publisher");

				PublicationEvent publication = null;
				if (publicationNode != null)
				{
					var placeNode = publicationNode.SelectSingleNode("place_of_publication/value/text()");
					var yearNode = publicationNode.SelectSingleNode("year_of_publication/text()");
					publication = new PublicationEvent
						{
							Place = placeNode != null ? placeNode.Value : null,
							Year = yearNode != null ? yearNode.Value : null,
						};
				}

				yield return new ItemLiterature()
					{
						Priref = priref,
						Title = title,
						Author = author,
						Publication = publication
					};
				
			}

		}
	}
}