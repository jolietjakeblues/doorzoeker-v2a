using System;
using System.Net.Http.Formatting;
using System.Web;
using System.Web.Hosting;
using System.Web.Http;
using System.Web.Mvc;
using System.Web.Optimization;
using System.Web.Razor.Generator;
using System.Web.Routing;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using NLog;
using NLog.Config;
using NLog.Targets;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services.Mappers;

namespace RceDoorzoeker
{
	// Note: For instructions on enabling IIS6 or IIS7 classic mode, 
	// visit http://go.microsoft.com/?LinkId=9394801

	public class MvcApplication : HttpApplication
	{
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();

		public static bool ReleaseBuild
		{
			get
			{
				#if DEBUG
					return false;
				#else
					return true;
				#endif
			}
		}

		protected void Application_Start()
		{
			InitializeConfiguration();

			InitLogging();

			FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);

			AreaRegistration.RegisterAllAreas();

			BundleTable.EnableOptimizations = ReleaseBuild;

			BundleConfig.RegisterBundles(BundleTable.Bundles);

			RouteTable.Routes.IgnoreRoute("{resource}.axd/{*pathInfo}");

			WebApiConfig.Register(GlobalConfiguration.Configuration);
	
			RouteConfig.RegisterRoutes(RouteTable.Routes);

			DoorzoekerModelMapper.ConfigureMapper();

			var config = GlobalConfiguration.Configuration;

			config.Formatters.Clear();

			var jsonMediaTypeFormatter = new JsonMediaTypeFormatter
				{
					SerializerSettings =
						{
							ContractResolver = new CamelCasePropertyNamesContractResolver(),
							NullValueHandling = NullValueHandling.Ignore
						}
				};

			config.Formatters.Add(jsonMediaTypeFormatter);

			s_logger.Info("Application started.");

		}

		private void InitLogging()
		{
			var cfg = new LoggingConfiguration();

			var fileTarget = new FileTarget()
				{
					FileName = string.Format("${{basedir}}/App_Data/NLog-{0}.log", Instance.Current.Name),
					Layout = "${longdate} ${level} ${logger} ${message} ${exception:format=tostring}",
					ArchiveAboveSize = 2000000,
					ArchiveNumbering = ArchiveNumberingMode.Sequence,
					ArchiveEvery = FileArchivePeriod.Month,
					MaxArchiveFiles = 10,
					ConcurrentWrites = false,
					KeepFileOpen = true,
					EnableFileDelete = true,
					ArchiveFileName = string.Format("${{basedir}}/App_Data/NLog-{0}_archive_{{###}}.log", Instance.Current.Name)
				};

			var traceTarget = new TraceTarget()
				{
					Layout = "${level} ${logger} ${message} ${exception:format=tostring}"
				};

			cfg.AddTarget("instancefile", fileTarget);
			cfg.LoggingRules.Add(new LoggingRule("*", LogLevel.Info, fileTarget));

			cfg.AddTarget("trace", traceTarget);
			cfg.LoggingRules.Add(new LoggingRule("*", LogLevel.Info, traceTarget));

			LogManager.Configuration = cfg;
		}

		private static void InitializeConfiguration()
		{
			var instanceConfig = InstanceRegistry.Current.GetBySiteName(HostingEnvironment.SiteName);
			if (instanceConfig == null)
				throw new ApplicationException("Can't find instance configuration for site " + HostingEnvironment.SiteName);
			
			Instance.Current = instanceConfig;

			DoorzoekerConfig.Current = DoorzoekerConfig.Load(instanceConfig.Config);
		}

		protected void Application_End()
		{
			s_logger.Info("Application ended");
		}

	}
}