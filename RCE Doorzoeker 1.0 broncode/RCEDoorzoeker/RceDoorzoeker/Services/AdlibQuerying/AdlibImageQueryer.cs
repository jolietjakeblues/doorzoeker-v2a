using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Web;
using System.Xml.XPath;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services.RnaApiClient.DTO;
using Trezorix.RnaRemote.Core.ContentItems;
using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Services.AdlibQuerying
{
	public class AdlibImageQueryer
	{
		private readonly string _apiBaseUrl;
		
		public AdlibImageQueryer(string apiBaseUrl)
		{
			_apiBaseUrl = apiBaseUrl;
		}

		public PagedList<ItemImage> ListImages(Item item, int start = 0, int count = 10)
		{
			var query = DetermineQuery(item, start, count);

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

			var images = ParseItemImages(xPathDocument);
			
			return new PagedList<ItemImage>()
				{
					Items = images.ToList(),
					TotalCount = ParseTotalCount(xPathDocument)
				};
		}

		public ItemImage GetPreferredImage(Item item)
		{
			var query = DetermineQuery(item, 0, 1);

			var client = new HttpClient();
			client.BaseAddress = new Uri(_apiBaseUrl);
			client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("text/xml"));

			// Note: Could be really specific about the fields we need

			// Note: preferred image for now is the first image for the URI
			HttpResponseMessage response = client.GetAsync(query).Result;

			if (!response.IsSuccessStatusCode)
			{
				throw new HttpException((int)HttpStatusCode.BadRequest,
					string.Format("Error retrieving images for item {0} error: {1}", item.Uri, response.ReasonPhrase));
			}

			var xPathDocument = new XPathDocument(response.Content.ReadAsStreamAsync().Result);

			var image = ParseItemImages(xPathDocument).FirstOrDefault();

			return image;
		}

		private string DetermineQuery(Item item, int start, int count)
		{
			// if the item has a monument number use it in query, otherwise query on uri
			var monumentNumber = ObtainMonumentNumber(item);
			if (monumentNumber != null)
			{
				return string.Format("?database=images&search=pointer%201009%20and%20monument.record_number-%3EmD=%22{0}%22&startFrom={1}&limit={2}&xmltype=grouped", monumentNumber, start, count);
			}
			
			return string.Format("?database=images&search=pointer%201009%20and%20ip-%3ERN='{0}'&startfrom={1}&limit={2}", item.Uri, start, count);
		}

		private object ObtainMonumentNumber(Item item)
		{
			var contentItem = item as ContentItem;
			if (contentItem != null)
			{
				var monumentNumberStatement = contentItem.Statements.SingleOrDefault(
						s => s.PredicateResource.Uri == DoorzoekerConfig.Current.MonumentNumberPredicateUri);

				if (monumentNumberStatement != null)
				{
					return monumentNumberStatement.Object.Literal;
				}
			}
			return null;
		}

		private int ParseTotalCount(XPathDocument xPathDocument)
		{
			var node = xPathDocument.CreateNavigator().SelectSingleNode("//diagnostic/hits/text()");

			return node.ValueAsInt;
		}

		private IEnumerable<ItemImage> ParseItemImages(XPathDocument xPathDocument)
		{
			var records = xPathDocument.CreateNavigator().Select("//record");

			foreach (XPathNavigator record in records)
			{
				var priref = record.SelectSingleNode("priref/text()").Value;
				var monumentRecord = record.SelectSingleNode("Monument/monument.record_number");

				string name = null;
				string monumentNr = null;
				if (monumentRecord != null)
				{
					var nameNode = monumentRecord.SelectSingleNode("object_name[1]/text()");
					if (nameNode != null)
					{
						name = nameNode.Value;
					}

					var monumentNrNode = monumentRecord.SelectSingleNode("monument_number/text()");
				
					if (monumentNrNode != null)
					{
						monumentNr = monumentNrNode.Value;
					}
				}
				
				var description = record.SelectSingleNode("Description/description/text()").Value;

				var repoIdNodes = record.Select("Reproduction/reproduction.reference/text()");

				foreach (XPathNavigator node in repoIdNodes)
				{
					yield return new ItemImage()
					{
						ReproductionId = Guid.Parse(node.Value),
						Description = description,
						MonumentNr = monumentNr,
						Name = name,
						BeeldbankUrl = string.Format("http://beeldbank.cultureelerfgoed.nl/{0}", priref)
					};
				}
			}

		}
	}
}