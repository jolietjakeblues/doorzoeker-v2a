using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Xml;
using RceDoorzoeker.Services.RnaApiClient.DTO;
using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Services.Querying
{
	public class XmlReaderItemResultParser
	{
		private readonly Regex _labelRegex = new Regex("skos_prefLabel_lang_(.+)", RegexOptions.Compiled);
		private readonly XmlReader _reader;
		private int _resultCount;

		public XmlReaderItemResultParser(Stream solrXmlResultStream)
		{
			_reader = XmlReader.Create(solrXmlResultStream, new XmlReaderSettings()
				{
					CloseInput = false,
					IgnoreComments = true,
					IgnoreWhitespace = true,
					IgnoreProcessingInstructions = true
				});

			_reader.Read();
			_reader.MoveToContent();
			
			ParseResultCount();

			_reader.MoveToElement();
		}

		public int ResultCount
		{
			get { return _resultCount; }
		}

		private void ParseResultCount()
		{
			_reader.ReadToFollowing("result");

			_resultCount = Convert.ToInt32(_reader.GetAttribute("numFound"));
		}

		public PagedList<SearchResultItem> ParseItems()
		{
			var newItems = ParseItems(_reader).ToList();

			return new PagedList<SearchResultItem>()
				{
					Items = newItems,
					TotalCount = ResultCount
				};
		}

		private IEnumerable<SearchResultItem> ParseItems(XmlReader reader)
		{
			if (!reader.ReadToFollowing("doc"))
			{
				yield break;
			}

			do
			{
				var item = ParseDoc(reader);
				yield return item;
				

			} while (reader.ReadToNextSibling("doc"));

		}

		private SearchResultItem ParseDoc(XmlReader reader)
		{
			LatLong coordinate = null;

			var item = new SearchResultItem();

			var labels = new List<SkosProperty>();

			reader.Read();

			do
			{
				string name;
				switch (reader.Name)
				{
					case "str":
						// id, item_name, pref labels
						name = reader.GetAttribute("name");
						if (name != null)
						{
							switch (name)
							{
								case "id":
									item.Uri = reader.ReadElementContentAsString();
									break;
								case "item_name":
									item.Name = reader.ReadElementContentAsString();
									break;
								default:
									var matchLabel = _labelRegex.Match(name);
									if (matchLabel.Success)
									{
										labels.Add(new SkosProperty()
											{
												Language = matchLabel.Groups[1].Value,
												Value = reader.ReadElementContentAsString()
											});
									}
									else
									{
										reader.Skip();
									}
									break;
							}
						}

						break;
					case "arr":
						// item type
						name = reader.GetAttribute("name");
						if (name != null)
						{
							switch (name)
							{
								case "rnax_resource_itemType":
									reader.ReadToFollowing("str");
									item.ItemTypeUri = reader.ReadElementContentAsString();
									reader.ReadEndElement();
									break;
								case "rnax_float_hasLatitude":
									reader.ReadToFollowing("double");
									if (coordinate == null)
									{
										coordinate = new LatLong();
									}
									var lat = reader.ReadElementContentAsDouble();
									reader.ReadEndElement();
									coordinate.Latitude = lat;
									break;
								case "rnax_float_hasLongitude":
									reader.ReadToFollowing("double");
									if (coordinate == null)
									{
										coordinate = new LatLong();
									}
									coordinate.Longitude = reader.ReadElementContentAsDouble();
									reader.ReadEndElement();
									break;
								default:
									reader.Skip();
									break;
							}
						}

						break;
					default:
						reader.Skip();
						break;
				}

				
			} while (reader.NodeType != XmlNodeType.EndElement && !reader.Name.Equals("doc"));
			
			item.Labels = labels;
			item.Coordinate = coordinate;

			return item;
		}

	}
}
