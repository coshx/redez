const fs = require('fs');

// Takes json as input and outputs react components as files in /output
module.exports = function jsonToComponents(json) {

  const { name, detailViewFields, collectionViewFields } = json;
  const templateData = fs.readFileSync('./templates/detailComponentTemplate.js').toString();
  // replace $[name] with name. First letter uppercase for React.
  let detailData = templateData.replace('$[name]', `${name.charAt(0).toUpperCase() + name.slice(1)}`);

  // let fieldsJSX = <div>;
  // for (field in detailViewFields) {
  //   let detailFieldJSX = (
  //     <div>
  //       <p> {field.name} </p>
  //     </div>
  //   );
  //   fieldsJSX += detailFieldJSX;
  // }
  // fieldsJSX += </div>;
  detailData = detailData.replace('$[fields]', '<p> Test </p>');
  console.log(detailData);
  fs.writeFileSync(`./output/${name.toLowerCase()}DetailComponent.js`, detailData);
};
