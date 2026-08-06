using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Xml.XPath;
using RceDoorzoeker.Services.RnaApiClient.DTO;
using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Services.Querying
{
	public class ItemsResultParser
	{
		public virtual PagedList<SearchResultItem> Parse(XPathDocument xml)
		{
			var nav = xml.CreateNavigator();

			var resultNode = nav.SelectSingleNode("response/result");

			int count = int.Parse(resultNode.GetAttribute("numFound", ""));

			var newItems = ParseItems(resultNode);

			return new PagedList<SearchResultItem>()
				{
					Items = newItems,
					TotalCount = count
				};
		}

		public PagedList<ItemSuggestResult> ParseItemSuggestions(XPathDocument xml)
		{
			var nav = xml.CreateNavigator();

			var resultNode = nav.SelectSingleNode("response/result");

			int count = int.Parse(resultNode.GetAttribute("numFound", ""));

			var newItems = ParseItemSuggestResults(resultNode);

			return new PagedList<ItemSuggestResult>()
			{
				Items = newItems,
				TotalCount = count
			};
		}

		private static List<SearchResultItem> ParseItems(XPathNavigator resultNode)
		{
			var itemElements = resultNode.Select("doc");

			var newItems = new List<SearchResultItem>(itemElements.Count);

			foreach (XPathNavigator itemEl in itemElements)
			{
				var itemTypeNode = itemEl.SelectSingleNode("arr[@name='rnax_resource_itemType']/str");

				var prefLabels = ParseLabelList("prefLabel", itemEl);
				
				var lat = itemEl.SelectSingleNode("arr[@name='rnax_float_hasLatitude']/double");
				var lng = itemEl.SelectSingleNode("arr[@name='rnax_float_hasLongitude']/double");
				
				LatLong coordinate = null;
				if (lat != null && lng != null)
				{
					coordinate = new LatLong()
						{
							Latitude = Double.Parse(lat.Value, NumberFormatInfo.InvariantInfo),
							Longitude = Double.Parse(lng.Value, NumberFormatInfo.InvariantInfo)
						};
				}
				
				var newReferrer = new SearchResultItem()
					{
						Uri = itemEl.SelectSingleNode("str[@name='id']").Value,
						Name = itemEl.SelectSingleNode("str[@name='item_name']").Value,
						Labels = prefLabels,
						ItemTypeUri = itemTypeNode != null ? itemTypeNode.Value : null,
						Coordinate = coordinate
					};

				newItems.Add(newReferrer);
			}
			return newItems;
		}

		private static List<ItemSuggestResult> ParseItemSuggestResults(XPathNavigator resultNode)
		{
			var itemElements = resultNode.Select("doc");

			var newItems = new List<ItemSuggestResult>(itemElements.Count);

			foreach (XPathNavigator itemEl in itemElements)
			{
				var itemTypeNode = itemEl.SelectSingleNode("arr[@name='rnax_resource_itemType']/str");

				var prefLabels = ParseLabelList("prefLabel", itemEl);
				var altLabels = ParseLabelList("altLabel", itemEl);

				var newSuggetsion = new ItemSuggestResult()
				{
					Uri = itemEl.SelectSingleNode("str[@name='id']").Value,
					Name = itemEl.SelectSingleNode("str[@name='item_name']").Value,
					PrefLabels = prefLabels,
					AltLabels = altLabels,
					ItemTypeUri = itemTypeNode != null ? itemTypeNode.Value : null
				};

				newItems.Add(newSuggetsion);
			}
			return newItems;
		}

		private static List<SkosProperty> ParseLabelList(string labelType, XPathNavigator itemEl)
		{
			string labelSelector = string.Format("str[starts-with(@name, 'skos_{0}_lang_')]", labelType);
			var prefLabels = itemEl.Select(labelSelector)
				.OfType<XPathNavigator>()
				.Select(CreateSkosProperties)
				.ToList();
			return prefLabels;
		}

		private static SkosProperty CreateSkosProperties(XPathNavigator l)
		{
			var languageFromFieldName = ParseLanguageFromFieldName(l.GetAttribute("name", ""));
			return new SkosProperty()
				{
					Value = l.Value,
					Language = languageFromFieldName
				};
		}

		private static string ParseLanguageFromFieldName(string fieldName)
		{
			var lastwordSeparator = fieldName.LastIndexOf("_");
			return fieldName.Substring(lastwordSeparator + 1, fieldName.Length - (lastwordSeparator + 1));
		}
	}

	
}
