using System;
using System.Web.Optimization;

namespace RceDoorzoeker
{
	public class BundleConfig
	{
		public static void RegisterBundles(BundleCollection bundles)
		{
			bundles.IgnoreList.Clear();
			AddDefaultIgnorePatterns(bundles.IgnoreList);

			bundles.Add(
			  new StyleBundle("~/Content/css")
				.Include("~/Content/ie10mobile.css") // ToDo: why/what
				//.Include("~/Content/bootstrap/bootstrap.min.css")
				//.Include("~/Content/bootstrap/bootstrap.css")
				//.Include("~/Content/bootstrap-responsive.min.css")
				.Include("~/Content/font-awesome.min.css")
				.Include("~/Content/typeahead.css")
				.Include("~/App/doorzoeker.css")
			  );

			bundles.Add(new ScriptBundle("~/bundled/doorzoeker")
				.Include("~/Scripts/jquery-{version}.js")
				.Include("~/Scripts/bootstrap.js")
				.Include("~/Scripts/angular.js")
				//.Include("~/Scripts/angular-resource.js")
				.Include("~/Scripts/angular-route.js")
				.Include("~/Scripts/typeahead.bundle.js")
				.Include("~/Scripts/jquery-deparam.js")
				.IncludeDirectory("~/App", "*.js", true)
			);

			bundles.Add(new ScriptBundle("~/bundled/admin-console")
				.Include("~/Scripts/jquery-{version}.js")
				.Include("~/Scripts/bootstrap.js")
				.Include("~/Scripts/angular.js")
				.IncludeDirectory("~/AdminConsoleApp", "*.js", true)
			);
		}

		public static void AddDefaultIgnorePatterns(IgnoreList ignoreList)
		{
			if (ignoreList == null)
			{
				throw new ArgumentNullException("ignoreList");
			}

			ignoreList.Ignore("*.intellisense.js");
			ignoreList.Ignore("*-vsdoc.js");
			ignoreList.Ignore("*.debug.js", OptimizationMode.WhenEnabled);
			//ignoreList.Ignore("*.min.js", OptimizationMode.WhenDisabled);
			//ignoreList.Ignore("*.min.css", OptimizationMode.WhenDisabled);
		}
	}
}