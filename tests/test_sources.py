import importlib.util
import unittest
import urllib.error
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('check_sources',Path(__file__).resolve().parents[1]/'scripts/check_sources.py')
M=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(M)


class FakeClient:
    def __init__(self, data):self.data=data
    def get(self,url,as_json=False):
        value=self.data[url]
        if isinstance(value,Exception):raise value
        return value


class SourcesTest(unittest.TestCase):
    def test_missing_experts_remain_missing(self):
        facts=M.config_facts({'text_config':{'num_experts':256,'shared_expert_intermediate_size':1024,'num_experts_per_tok':8}})
        self.assertNotIn('shared',facts)
        self.assertEqual(facts['routed']['locator'],'text_config.num_experts')
        self.assertNotIn('total',facts)
        self.assertNotIn('active',facts)

    def test_explicit_mtp_zero_is_preserved(self):
        facts=M.config_facts({'num_nextn_predict_layers':0,'n_shared_experts':0})
        self.assertEqual(facts['mtp_layers']['value'],0)
        self.assertEqual(facts['shared']['value'],0)

    def test_gated_config_is_not_an_absent_module(self):
        url='https://huggingface.co/x/model/raw/new/config.json'
        client=FakeClient({'https://huggingface.co/api/models/x/model':{'sha':'new'},url:urllib.error.HTTPError(url,401,'gated',{},None)})
        _,state,_=M.inspect_repo(client,'x/model',None)
        self.assertNotIn('config',state)
        self.assertIn('401',state['config_access'])

    def test_revision_change_returns_fixed_source_and_diff(self):
        client=FakeClient({'https://huggingface.co/api/models/x/model':{'sha':'new'},'https://huggingface.co/x/model/raw/new/config.json':{'n_routed_experts':128}})
        old={'sha':'old','config':{'routed':{'value':64,'locator':'n_routed_experts'}}}
        _,_,change=M.inspect_repo(client,'x/model',old)
        self.assertEqual(change['configChanges']['routed']['after']['value'],128)
        self.assertIn('/raw/new/',change['configSource'])
        self.assertNotIn('active',change['configChanges'])

    def test_initial_observation_is_not_a_parameter_update(self):
        client=FakeClient({'https://huggingface.co/api/models/x/model':{'sha':'new'},'https://huggingface.co/x/model/raw/new/config.json':{'num_hidden_layers':12},'https://docs.sglang.io/a':'<main>recipe</main>'})
        catalog={'models':[{'repo':'x/model','access':'weights'},{'repo':'closed-api','access':'api'}],'frameworkIndex':{'entries':[]}}
        policy={'documents':['https://docs.sglang.io/a'],'watchFrameworkRecipePages':False}
        report,_=M.run(client,catalog,policy,{},'2026-10-16T00:00:00Z',False,1)
        self.assertEqual(report['changes'],[])
        self.assertEqual(len(report['baselined']),2)
        self.assertEqual(report['errors'],[])

    def test_read_failure_retains_baseline_and_reports_error(self):
        old={'sha':'old','config':{}}
        client=FakeClient({'https://huggingface.co/api/models/x/model':TimeoutError()})
        catalog={'models':[{'repo':'x/model','access':'weights'}],'frameworkIndex':{'entries':[]}}
        report,state=M.run(client,catalog,{'documents':[]},{'repos':{'x/model':old}},'now',False,1)
        self.assertEqual(state['repos']['x/model'],old)
        self.assertEqual(report['changes'],[])
        self.assertEqual(len(report['errors']),1)

    def test_model_discovery_filters_known_and_old(self):
        rows=[{'id':'X/Known','createdAt':'2026-10-16'},{'id':'X/Old','createdAt':'2025-01-01'},{'id':'X/New','createdAt':'2026-10-16'}]
        self.assertEqual([x['repo'] for x in M.new_models(rows,{'x/known'},'2026-10-15')],['X/New'])

    def test_document_navigation_does_not_trigger_content_change(self):
        a='<nav>old menu</nav><main><p>Model 128 experts</p></main>'
        b='<nav>new menu</nav><main><p>Model 128 experts</p></main>'
        self.assertEqual(M.document_fingerprint(a),M.document_fingerprint(b))
        self.assertNotEqual(M.document_fingerprint(a),M.document_fingerprint(b.replace('128','256')))

    def test_new_recipe_paths_are_reported(self):
        url='https://docs.sglang.io/llms.txt'
        text='[New](https://docs.sglang.io/cookbook/autoregressive/Vendor/New.md)'
        _,_,change=M.inspect_document(FakeClient({url:text}),url,{'sha256':'old','recipePages':[]})
        self.assertEqual(change['newRecipePages'],['https://docs.sglang.io/cookbook/autoregressive/Vendor/New'])


if __name__=='__main__':unittest.main()
