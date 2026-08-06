using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Web;
using System.Web.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services.ConfigSwitcher;

namespace RceDoorzoeker.Controllers
{
	[Authorize]
	public class AdminController : Controller
	{
		[OutputCache(VaryByParam = "*", Duration = 0, NoStore = true)]
		public ActionResult Index()
		{
			return View();
		}
		
		[HttpGet]
		public ActionResult Config()
		{
			Response.AddHeader("Content-Disposition", string.Format("attachment; filename=\"{0}.xml\"", Path.GetFileName(DoorzoekerConfig.Current.FilePathName)));
			return File(DoorzoekerConfig.Current.FilePathName, "application/xml");
		}

		public ActionResult RevertConfig()
		{
			var swapper = new ConfigSwitcher(DoorzoekerConfig.Current.FilePathName);
			if (swapper.DetermineBackupNumber() == 0)
			{
				return new HttpStatusCodeResult(HttpStatusCode.BadRequest, "Geen backup bestand(en) beschikbaar."); 
			}

			swapper.RestoreBackup();

			HttpRuntime.UnloadAppDomain();

			return Json(new { success = true });
		}

		public ActionResult UploadConfig(HttpPostedFileBase file)
		{
			string result;
			if (file == null)
			{
				var value = new
					{
						success = false,
						messages = new[] { new ValidationResult(ValidationResultLevels.Error, "Geen configuratie bestand opgegeven.") }
					};

				result = JsonSerializeResult(value);

				ViewData.Model = result;
				return View();
			}

			// create guid based temp filename next to the target configuration
			var path = Path.GetDirectoryName(DoorzoekerConfig.Current.FilePathName);
			var tmpFile = Path.Combine(path, string.Format("{0}.tmp.cfg", Guid.NewGuid()));

			file.SaveAs(tmpFile);
			
			var swapper = new ConfigSwitcher(DoorzoekerConfig.Current.FilePathName);
			var validationResult = swapper.ValidateConfig(tmpFile);

			if (validationResult.Any())
			{
				var valError = new
				{
					success = false,
					messages = validationResult
				};

				result = JsonSerializeResult(valError);
				
				ViewData.Model = result;
				return View();
			}

			swapper.EstablishNewConfig(tmpFile);

			var success = new
				{
					success = true,
				};

			result = JsonSerializeResult(success);

			ViewData.Model = result;
			
			HttpRuntime.UnloadAppDomain();

			return View();
		}

		private static string JsonSerializeResult(object value)
		{
			string result = JsonConvert.SerializeObject(value, Formatting.Indented,
				new JsonSerializerSettings
					{
						ContractResolver = new CamelCasePropertyNamesContractResolver() 
					});
			return result;
		}

		public void RestartApplication()
		{
			HttpRuntime.UnloadAppDomain();
		}
	}
}
