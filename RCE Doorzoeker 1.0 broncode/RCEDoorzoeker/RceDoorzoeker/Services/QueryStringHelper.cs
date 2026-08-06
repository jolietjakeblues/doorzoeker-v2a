using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Text;
using System.Web;

namespace RceDoorzoeker.Services
{
	public static class QueryStringHelper
	{
		public static string ToFormsQueryString(this NameValueCollection pars)
		{
			var sb = new StringBuilder();
			
			bool first = true;
			foreach(var key in pars.AllKeys)
			{
				var values = pars.GetValues(key);
				if (values == null || values.Length == 0)
				{
					continue;
				}

				if (first)
				{
					first = false;
				}
				else
				{
					sb.Append("&");	
				}

				
				var keyValue = String.Format("&{0}=", key);
				
				sb.Append(key + "=");
				sb.Append(String.Join(keyValue, values));

			}

			return sb.ToString();
		}
	}
}