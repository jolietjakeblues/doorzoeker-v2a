using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Web.Http.Dependencies;
using NLog;
using SimpleInjector;

namespace RceDoorzoeker
{
	public sealed class SimpleInjectorWebApiDependencyResolver : IDependencyResolver
	{
		private readonly Container _container;
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();

		public SimpleInjectorWebApiDependencyResolver(
			Container container)
		{
			this._container = container;
		}

		[DebuggerStepThrough]
		public IDependencyScope BeginScope()
		{
			return this;
		}

		//[DebuggerStepThrough]
		public object GetService(Type serviceType)
		{
			try
			{
				return ((IServiceProvider)this._container)
					.GetService(serviceType);
			}
			catch (Exception e)
			{
				s_logger.Error(e);
				throw;
			}
		}

		//[DebuggerStepThrough]
		public IEnumerable<object> GetServices(Type serviceType)
		{
			try
			{
				return this._container.GetAllInstances(serviceType);
			}
			catch (Exception e)
			{
				s_logger.Error(e);
				throw;
			}
		}

		[DebuggerStepThrough]
		public void Dispose()
		{
		}
	}
}