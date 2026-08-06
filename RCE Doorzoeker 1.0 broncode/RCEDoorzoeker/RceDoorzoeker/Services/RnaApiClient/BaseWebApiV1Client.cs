using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using Trezorix.RnaRemote;

namespace RceDoorzoeker.Services.RnaApiClient
{
	public class BaseWebApiV1Client
	{
		private readonly RnaApiConnector _apiConnector;

		public BaseWebApiV1Client(RnaApiConnector apiConnector)
		{
			_apiConnector = apiConnector;
		}

		public Stream ApiCall(string url, string query)
		{
			if (query == null)
			{
				throw new ArgumentNullException("query");
			}

			if (query.Length > 0)
			{
				query += "&";
			}

			query += "rna_api_key=" + _apiConnector.ApiKey;

			return ExecuteApiCall(url, query);
		}

		protected T ApiCall<T>(string url, string query, ParseResponse parser = null)
		{
			if (query == null)
			{
				throw new ArgumentNullException("query");
			}

			if (query.Length > 0)
			{
				query += "&";
			}

			query += "rna_api_key=" + _apiConnector.ApiKey;

			return ExecuteApiCall<T>(url, query, parser);
		}

		public delegate object ParseResponse(Stream responseStream);

		private ParseResponse DetermineDefaultParser<T>()
		{
			ParseResponse parser;
			if (typeof(T) == typeof(XmlDocument))
			{
				parser = XmlDocumentApiResponseParser;
			}
			else if (typeof(T) == typeof(XDocument))
			{
				parser = XDocumentApiResponseParser;
			}
			else if (typeof(T) == typeof(IEnumerable<string>))
			{
				parser = StringListParser;
			}
			else if (typeof (T) == typeof (String))
			{
				parser = StringParser;
			}
			else
			{
				throw new Exception("No response parser for type " + typeof(T).Name);
			}

			return parser;
		}

		private T ExecuteApiCall<T>(string url, string query, ParseResponse parser = null)
		{
			if (parser == null)
			{
				parser = DetermineDefaultParser<T>();
			}

			using (var responseStream = ExecuteApiCall(url, query))
			{
				return (T)parser(responseStream);
			}

		}

		private string StringParser(Stream responsestream)
		{
			using (var reader = new StreamReader(responsestream, Encoding.UTF8))
			{
				var data = reader.ReadToEnd();
				return data;
			}
		}

		private Stream ExecuteApiCall(string url, string query)
		{
			var request = SetupRequest(url, query);

			try
			{
				var response = (HttpWebResponse) request.GetResponse();
				
				if (response.StatusCode == HttpStatusCode.Redirect)
				{
					throw new Exception("Server responded with a redirect to " + response.Headers["Location"]);
				}

				var responseStream = response.GetResponseStream();
				return responseStream;
			}
			catch (WebException ex)
			{
				if (ex.Response == null)
				{
					throw;
				}
				using (var errorStream = ex.Response.GetResponseStream())
				{
					using (var errorReader = new StreamReader(errorStream))
					{
						string error = errorReader.ReadToEnd();
						throw new RnaConnectorException(
							string.Format("RnaApi call failed with status {0} and the following response message: {1}", ex.Status, error));
					}
				}
			}
		}
		private IEnumerable<string> StringListParser(Stream responsestream)
		{
			using (var reader = new StreamReader(responsestream, Encoding.UTF8))
			{
				var list = new List<string>(50);
				while (true)
				{
					string line = reader.ReadLine();

					if (string.IsNullOrEmpty(line)) return list;

					list.Add(line);
				}
			}
		}

		private HttpWebRequest SetupRequest(string url, string query)
		{
			var request = (HttpWebRequest)WebRequest.Create(_apiConnector.ApiBaseUrl + url);

			request.Method = "POST";

			request.Timeout = 1200000;
			request.AllowAutoRedirect = false;

			byte[] queryData = Encoding.UTF8.GetBytes(query);

			request.ContentType = "application/x-www-form-urlencoded";
			request.ContentLength = queryData.Length;

			using (var requestStream = request.GetRequestStream())
			{
				requestStream.Write(queryData, 0, queryData.Length);
				requestStream.Close();
			}

			return request;
		}

		private static XmlDocument XmlDocumentApiResponseParser(Stream responseStream)
		{
			var xml = new XmlDocument();

			xml.Load(responseStream);

			return xml;
		}

		private XDocument XDocumentApiResponseParser(Stream responseStream)
		{
			using (var reader = XmlReader.Create(responseStream))
			{
				var xml = XDocument.Load(reader);
				xml.Root.Add(new XAttribute("request", _apiConnector.ApiBaseUrl));

				reader.Close();
				return xml;
			}
		}

	}
}